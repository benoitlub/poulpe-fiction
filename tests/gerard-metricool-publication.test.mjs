import test from "node:test";
import assert from "node:assert/strict";
import { metricoolMission, submitMetricoolPublication } from "../scripts/gerard-metricool-publication.mjs";

const candidate = { status: "ready", harvestId: "harvest-1", seedId: "blacklace-dice",
  copy: { text: "Une décision de Gérard." }, media: null, compatibleNetworks: ["facebook"],
  transport: { provider: "metricool" }, editorialRoute: { destination: { preferredProvider: "metricool" } } };
test("Gerard requests the existing Octopus social.publish capability and defaults to preview", () => {
  const mission = metricoolMission(candidate);
  assert.deepEqual(mission.requiredCapabilities, ["social.publish"]);
  assert.deepEqual(mission.authorizedResources, ["social.publish"]);
  assert.equal(mission.context.metadata.socialPublication.dryRun, true);
  assert.ok(!("publicationDate" in mission.context.metadata.socialPublication));
  assert.deepEqual(mission.context.metadata.socialPublication.networks, ["facebook"]);
});
test("publication key survives clock changes; an altered artifact gets a new key", () => {
  const one = metricoolMission(candidate, { now: new Date(1) });
  const two = metricoolMission(candidate, { now: new Date(2) });
  assert.notEqual(one.operationId, two.operationId);
  assert.equal(one.context.metadata.socialPublication.operationId, two.context.metadata.socialPublication.operationId);
  assert.notEqual(one.context.metadata.socialPublication.operationId, metricoolMission({ ...candidate, copy: { text: "Autre" } }).context.metadata.socialPublication.operationId);
});
test("books routed to Buffer and blocked candidates never enter Metricool", () => {
  for (const value of [{ ...candidate, action: "do-not-schedule" }, { ...candidate, status: "blocked" }, { ...candidate, transport: { provider: "buffer" } }]) assert.equal(metricoolMission(value), null);
});
test("an image does not add Instagram to Gerard's Facebook-only decision", () => {
  assert.deepEqual(metricoolMission({ ...candidate, media: { url: "https://example.org/image.png" } }).context.metadata.socialPublication.networks, ["facebook"]);
  assert.equal(metricoolMission({ ...candidate, compatibleNetworks: ["facebook", "unknown"] }), null);
});
test("only provider-confirmed scheduled outcomes become confirmed deliveries", async () => {
  const updated = await submitMetricoolPublication(candidate, { execute: true, fetchImpl: async (url, init) => {
    assert.equal(url, "http://127.0.0.1:3000/mission");
    assert.equal(JSON.parse(init.body).context.metadata.socialPublication.dryRun, false);
    return Response.json({ status: "completed", output: { status: "confirmed-scheduled", scheduled: true, postId: "42", publicationDate: "2026-10-23T12:00:00" } });
  } });
  assert.equal(updated.delivery.status, "confirmed-scheduled"); assert.equal(updated.metricoolHandoff.postId, "42");
});
test("acceptance/ID alone, quota blocks and timeouts remain unconfirmed and retain ready content", async () => {
  for (const fetchImpl of [
    async () => Response.json({ status: "completed", output: { postId: "42" } }),
    async () => Response.json({ status: "waiting-authorization", output: { status: "quota-exhausted", scheduled: false, stage: "verified-budget" } }),
    async () => { throw new Error("timeout"); },
  ]) {
    const updated = await submitMetricoolPublication(candidate, { fetchImpl });
    assert.equal(updated.delivery.publishingEnabled, false);
    assert.equal(updated.status, "ready"); assert.deepEqual(updated.copy, candidate.copy);
    assert.ok(updated.metricoolHandoff.operationId);
  }
});

test("Buffer requires Gerard's exact channel, image and single Instagram destination", async () => {
  const { bufferMission, submitBufferPublication } = await import("../scripts/gerard-metricool-publication.mjs");
  const book = { ...candidate, transport: { provider: "buffer", channelId: "chosen-channel" },
    editorialRoute: { destination: { preferredProvider: "buffer" } }, media: { url: "https://example.org/cover.jpg" }, compatibleNetworks: ["instagram"] };
  const mission = bufferMission(book);
  assert.equal(mission.context.metadata.socialPublication.transport, "buffer");
  assert.equal(mission.context.metadata.socialPublication.channelId, "chosen-channel");
  assert.equal(mission.context.metadata.socialPublication.dryRun, true);
  for (const invalid of [{ ...book, transport: { provider: "buffer" } }, { ...book, media: null }, { ...book, compatibleNetworks: ["facebook", "instagram"] }]) assert.equal(bufferMission(invalid), null);
  const out = await submitBufferPublication(book, { execute: true, fetchImpl: async (_url, init) => {
    if (init.method === "HEAD") return new Response(null, { headers: { "content-type": "image/jpeg", "content-length": "2048" } });
    const publication = JSON.parse(init.body).context.metadata.socialPublication;
    assert.equal(publication.text, book.copy.text); assert.deepEqual(publication.media, [book.media.url]);
    return Response.json({ status: "completed", output: { status: "confirmed-scheduled", scheduled: true, postId: "buffer-simulated" } });
  } });
  assert.equal(out.bufferHandoff.postId, "buffer-simulated"); assert.equal(out.delivery.publishingEnabled, true);
  assert.equal(metricoolMission(book), null);
});

test("Blacklace TikTok MP4 can be handed off but wrong brand, image and mixed networks cannot", () => {
  const video = { ...candidate, media: { url: "https://cdn.example.org/short.mp4" },
    transport: { provider: "metricool", brandId: "7653100" }, compatibleNetworks: ["tiktok"] };
  const mission = metricoolMission(video);
  assert.deepEqual(mission.context.metadata.socialPublication.networks, ["tiktok"]);
  assert.equal(mission.context.metadata.socialPublication.dryRun, true);
  for (const invalid of [
    { ...video, media: { url: "https://cdn.example.org/cover.jpg" } },
    { ...video, transport: { provider: "metricool", brandId: "3350145" } },
    { ...video, compatibleNetworks: ["tiktok", "facebook"] },
  ]) assert.equal(metricoolMission(invalid), null);
});

test("nonexistent or non-media URLs cannot trigger publication", async () => {
  for (const response of [new Response(null,{status:404}),new Response(null,{headers:{"content-type":"text/html"}})]) {
    const calls=[];
    const out=await submitMetricoolPublication({...candidate,media:{url:"https://example.org/missing.png"}}, {
      execute:true,fetchImpl:async(url,init)=>{calls.push(init.method);return response;}
    });
    assert.deepEqual(calls,["HEAD"]);assert.equal(out.delivery.publishingEnabled,false);
    assert.equal(out.metricoolHandoff.reason,"PUBLICATION_MEDIA_UNAVAILABLE");
    assert.equal(out.metricoolHandoff.published,false);
  }
});

test('local fallback includes a project fact and source instead of a bare recycled question',async()=>{
 const {localEditorialCandidate}=await import('../scripts/gerard-metricool-publication.mjs');
 const c=localEditorialCandidate('blacklace-dice');
 assert.match(c.copy.text,/Dé anti-procrastination absurde/);
 assert.match(c.copy.text,/petite décision/);
 assert.equal(c.copy.strategy,'local-editorial-sourced');
 assert.match(c.editorialEvidence.source,/notion/);
 assert.equal(c.mediaStatus,'not-produced');
 assert.equal(c.media,undefined);
 assert.equal(localEditorialCandidate('jointed'),null,'no local invention of card mechanics without a source summary');
 assert.equal(localEditorialCandidate('unknown'),null);
 const variants=['entertainment','behind-the-scenes','promotion'].map(category=>localEditorialCandidate('blacklace-dice',category));
 assert.equal(new Set(variants.map(item=>item.copy.text)).size,3,'the grounded angles added in #231 retain distinct text');
 assert.equal(new Set(variants.map(item=>item.harvestId)).size,3);
 for(const item of variants) {
  assert.deepEqual(item.editorialEvidence,c.editorialEvidence,'changing the angle must preserve the verified project source');
  assert.ok(item.copy.text.includes(c.editorialEvidence.fact));
 }
 const promotion=variants[2],alias=localEditorialCandidate('blacklace-dice','unrecognized-angle');
 assert.equal(alias.copy.text,promotion.copy.text);
 assert.equal(alias.harvestId,promotion.harvestId,'a category label cannot disguise identical text as new content');
});

test('owner relay opts into readable review while preserving the canonical v1 JSON and stable operation id',async()=>{
 const {handoffMetricoolByEmail}=await import('../scripts/gerard-metricool-publication.mjs');
 const before=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
 process.env.ACTIONS_ID_TOKEN_REQUEST_URL='https://oidc.example/token';
 let posted,calls=0;
 try {
  const out=await handoffMetricoolByEmail({...candidate,title:'Blacklace Dice'},{fetchImpl:async(url,init)=>{
   calls++;
   if(new URL(url).hostname==='oidc.example')return Response.json({value:'fixture-token'});
   posted=JSON.parse(init.body);return Response.json({status:'sent'});
  }});
  assert.equal(calls,2);assert.equal(posted.presentation,'editorial-review-v1');
  const old=await handoffMetricoolByEmail({...candidate,harvestId:'gerard-facebook-fixture',copy:{text:'Ancienne question générique',strategy:'local-editorial'}},{fetchImpl:async()=>{throw Error('must not send legacy draft');}});
  assert.equal(old.metricoolHandoff,undefined);
  assert.ok(posted.subject.length<100);assert.ok(!posted.subject.includes('gerard-metricool-'));
  const relay=JSON.parse(posted.body);
  assert.equal(relay.contract,'gerard-metricool-mail-v1');assert.equal(relay.text,candidate.copy.text);
  assert.equal(posted.operationId,'gerard-mail-'+relay.operationId.slice('gerard-metricool-'.length));
  assert.equal(out.delivery.status,'mail-sent');assert.equal(out.delivery.publishingEnabled,false);
 } finally {if(before===undefined)delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;else process.env.ACTIONS_ID_TOKEN_REQUEST_URL=before;}
});

test('machine mode preserves the legacy subject and exact v1 body for an external consumer',async()=>{
 const {handoffMetricoolByEmail}=await import('../scripts/gerard-metricool-publication.mjs');
 const before=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;process.env.ACTIONS_ID_TOKEN_REQUEST_URL='https://oidc.example/token';
 let posted;
 try {
  await handoffMetricoolByEmail(candidate,{presentation:'machine',fetchImpl:async(url,init)=>{
   if(new URL(url).hostname==='oidc.example')return Response.json({value:'fixture-token'});
   posted=JSON.parse(init.body);return Response.json({status:'sent'});
  }});
  const relay=JSON.parse(posted.body);
  assert.equal(posted.subject,'[Gerard Metricool v1] '+relay.operationId);
  assert.equal(posted.presentation,undefined);
  assert.deepEqual(Object.keys(relay),['contract','operationId','harvestId','seedId','brandId','networks','text','media']);
 } finally {if(before===undefined)delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;else process.env.ACTIONS_ID_TOKEN_REQUEST_URL=before;}
});
