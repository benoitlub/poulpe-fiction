// Reuse Production's existing local Octopus -> Publisher -> Metricool route.
// No new provider, secret, queue or publication date is introduced here.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { submitMetricoolPublication, metricoolMission, localEditorialCandidate,
  directMetricoolEnabled, consumedDirectReceipt } from './gerard-metricool-publication.mjs';
const PREPARED = new URL('../garden/gerard-metricool-prepared.json', import.meta.url);
const RECEIPT = new URL('../garden/gerard-metricool-prepared-receipt.json', import.meta.url);
const readOptional = async url => {
  try { return JSON.parse(await readFile(url,'utf8')); }
  catch(error) { if(error.code === 'ENOENT')return null; throw error; }
};

export async function registerPreparedSource(candidate, {fetchImpl = fetch,
  publisherUrl = process.env.PUBLISHER_URL, preparedAt} = {}) {
  if (!candidate.harvestId.startsWith('gerard-facebook-')) return; // Already registered by Publisher.
  const local = localEditorialCandidate(candidate.seedId, candidate.category);
  // Only our exact sourced local draft can be registered by this fallback.
  // Keep old text-only drafts readable. An attached image must match the exact
  // project file, and an illustrated fallback may only target its declared network.
  const mediaUrl = candidate.media?.url;
  const expectedNetwork = mediaUrl ? local?.compatibleNetworks[0] : 'facebook';
  if (!local || local.harvestId !== candidate.harvestId || local.copy.text !== candidate.copy?.text ||
      candidate.copy.strategy !== 'local-editorial-sourced' || (candidate.parcelId && candidate.parcelId !== local.seedId) ||
      (mediaUrl && mediaUrl !== local.media?.url) || candidate.compatibleNetworks?.length !== 1 ||
      candidate.compatibleNetworks[0] !== expectedNetwork ||
      (candidate.media?.sourceHarvestId && candidate.media.sourceHarvestId !== local.harvestId))
    throw new Error('PREPARED_SOURCE_NOT_VERIFIABLE');
  const response = await fetchImpl(`${String(publisherUrl).replace(/\/$/,'')}/api/garden/harvests/sync`, {
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
    body:JSON.stringify({harvests:[{id:local.harvestId,parcelId:local.seedId,seedId:local.seedId,
      title:local.title,content:local.copy.text,url:local.editorialEvidence.source,
      ...(mediaUrl ? {downloadUrl:mediaUrl} : {}),
      type:'text',status:'ready',createdAt:preparedAt}]})
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'ok' || result.synced !== 1)
    throw new Error('PREPARED_SOURCE_SYNC_UNCONFIRMED');
}

export async function runDirectMetricoolDelivery(prepared, receipt, {
  enabled = process.env.GERARD_METRICOOL_DIRECT_EXECUTION_ENABLED,
  tokenPresent = Boolean(process.env.METRICOOL_EXECUTION_TOKEN || (process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)), now = Date.now(),
  submit = submitMetricoolPublication, register = registerPreparedSource,
  persist = async value => writeFile(RECEIPT,JSON.stringify(value,null,2)+'\n'),
} = {}) {
  if (!directMetricoolEnabled(enabled)) return {status:'direct-publishing-disabled',attempted:false};
  const candidate = prepared?.candidate;
  const age = now-Date.parse(prepared?.preparedAt);
  if (!candidate?.harvestId || !Number.isFinite(age) || age<0 || age>=86400000 ||
      candidate.copy?.strategy === 'local-editorial' ||
      /420[^a-z0-9]*dice/i.test([candidate.seedId,candidate.title].join(' ')) || !metricoolMission(candidate))
    return {status:'not-eligible',attempted:false};
  if (receipt?.harvestId === candidate.harvestId) {
    if (consumedDirectReceipt(receipt)) return {status:'already-handed-off',attempted:false,confirmationRequired:receipt.status === 'confirmation-required'};
    if (now<Date.parse(receipt.retryAt)) return {status:'deferred',reason:receipt.reason,retryAt:receipt.retryAt,attempted:false};
  }
  let handoff, attempted=false;
  if (!tokenPresent) handoff={status:'blocked',stage:'authorization',reason:'METRICOOL_EXECUTION_TOKEN_MISSING'};
  else {
    try { await register(candidate,{preparedAt:prepared.preparedAt}); }
    catch(error) { handoff={status:'blocked',stage:'provenance',reason:['PREPARED_SOURCE_NOT_VERIFIABLE','PREPARED_SOURCE_SYNC_UNCONFIRMED'].includes(error.message)?error.message:'PREPARED_SOURCE_SYNC_UNCONFIRMED'}; }
    if (!handoff) {
      attempted=true;
      // On an ambiguous external write, preserve the stable operation and stop.
      try { handoff=(await submit(candidate,{execute:true,octopusUrl:process.env.OCTOPUS_URL || 'http://127.0.0.1:3000'})).metricoolHandoff; }
      catch { handoff={status:'confirmation-required',stage:'transport',reason:'PUBLISHER_RESPONSE_UNCONFIRMED'}; }
      handoff ??= {status:'confirmation-required',stage:'transport',reason:'PUBLISHER_RESPONSE_UNCONFIRMED'};
    }
  }
  const saved={harvestId:candidate.harvestId,operationId:handoff.operationId ?? null,status:handoff.status,
    postId:handoff.postId ?? null,publicationDate:handoff.publicationDate ?? null,
    scheduled:handoff.scheduled === true,published:handoff.published === true,
    stage:handoff.stage ?? null,reason:handoff.reason ?? null,attemptedAt:new Date(now).toISOString()};
  // An ID/accepted mission alone is not confirmation. Match the builder's contract.
  saved.scheduled= saved.scheduled && handoff.status === 'confirmed-scheduled' && Boolean(saved.postId);
  saved.published= saved.published && handoff.status === 'confirmed-published' && Boolean(saved.postId);
  if (['confirmed-scheduled','confirmed-published'].includes(saved.status) && !saved.scheduled && !saved.published)
    saved.status='confirmation-required';
  if (!saved.scheduled && !saved.published && !['blocked','rejected','deferred'].includes(saved.status)) saved.status='confirmation-required';
  saved.confirmationRequired=['confirmation-required','pending','unknown'].includes(saved.status);
  if (Number.isFinite(handoff.retryAfterSeconds) && handoff.retryAfterSeconds>0)
    saved.retryAt=new Date(now+handoff.retryAfterSeconds*1000).toISOString();
  await persist(saved);
  return {...saved,attempted};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runDirectMetricoolDelivery(await readOptional(PREPARED),await readOptional(RECEIPT));
  console.log(JSON.stringify(result));
  if (!['confirmed-scheduled','confirmed-published','already-handed-off','direct-publishing-disabled','not-eligible'].includes(result.status)) process.exitCode=1;
}
