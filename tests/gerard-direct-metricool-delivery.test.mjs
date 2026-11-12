// All provider results are deterministic fixtures. No real social publication.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {runDirectMetricoolDelivery,registerPreparedSource} from '../scripts/gerard-direct-metricool-delivery.mjs';
import {localEditorialCandidate,submitMetricoolPublication,directMetricoolEnabled} from '../scripts/gerard-metricool-publication.mjs';
const now=Date.parse('2026-11-11T13:00:00Z');
const candidate=localEditorialCandidate('spectrl');
const prepared={preparedAt:new Date(now).toISOString(),candidate};
const options={enabled:'True',tokenPresent:true,now,register:async()=>{},persist:async()=>{}};
test('GitHub True and Node true agree; a ready draft reaches the real mission builder instead of Gmail',async()=>{
 for(const value of ['true','True',' TRUE '])assert.equal(directMetricoolEnabled(value),true);
 for(const value of ['false','1','',undefined])assert.equal(directMetricoolEnabled(value),false);
 let post,persisted,registered=0;
 const result=await runDirectMetricoolDelivery(prepared,null,{...options,register:async()=>{registered++;},persist:async r=>{persisted=r;},submit:(c,opts)=>submitMetricoolPublication(c,{...opts,fetchImpl:async(url,init)=>{
  assert.equal(url,'http://127.0.0.1:3000/mission');post=JSON.parse(init.body);
  return Response.json({status:'completed',output:{status:'confirmed-scheduled',scheduled:true,postId:'fixture-post',publicationDate:'2026-11-12T09:00:00'}});
 }})});
 assert.equal(registered,1);assert.equal(post.context.metadata.socialPublication.dryRun,false);
 assert.equal(result.scheduled,true);assert.equal(persisted.postId,'fixture-post');assert.equal(persisted.publicationDate,'2026-11-12T09:00:00');
 let called=false;
 await runDirectMetricoolDelivery(prepared,persisted,{...options,submit:async()=>{called=true;}});assert.equal(called,false);
});
test('missing existing token or source sync failure cannot call the scheduler; known blocks can resume',async()=>{
 let saved,calls=0;
 const submit=async()=>{calls++;return {metricoolHandoff:{status:'confirmed-scheduled',scheduled:true,postId:'fixture'}};};
 const missing=await runDirectMetricoolDelivery(prepared,null,{...options,tokenPresent:false,submit,persist:async r=>{saved=r;}});
 assert.equal(missing.reason,'METRICOOL_EXECUTION_TOKEN_MISSING');assert.equal(calls,0);assert.equal(missing.confirmationRequired,false);
 const resumed=await runDirectMetricoolDelivery(prepared,saved,{...options,submit});assert.equal(resumed.scheduled,true);
 const source=await runDirectMetricoolDelivery(prepared,null,{...options,submit,register:async()=>{throw Error('timeout');}});
 assert.equal(source.reason,'PREPARED_SOURCE_SYNC_UNCONFIRMED');assert.equal(calls,1);
});
test('quota delay resumes later, while uncertain writes and acceptance alone never become success',async()=>{
 let receipt,calls=0;
 const quota=await runDirectMetricoolDelivery(prepared,null,{...options,persist:async r=>{receipt=r;},submit:async()=>({metricoolHandoff:{status:'blocked',reason:'QUOTA_EXHAUSTED',retryAfterSeconds:120}})});
 assert.equal(quota.confirmationRequired,false);
 const deferred=await runDirectMetricoolDelivery(prepared,receipt,{...options,now:now+119000,submit:async()=>{calls++;}});assert.equal(deferred.status,'deferred');assert.equal(calls,0);
 await runDirectMetricoolDelivery(prepared,receipt,{...options,now:now+121000,submit:async()=>{calls++;return {metricoolHandoff:{status:'confirmation-required'}};},persist:async r=>{receipt=r;}});
 await runDirectMetricoolDelivery(prepared,receipt,{...options,submit:async()=>{calls++;}});assert.equal(calls,1);
 const accepted=await runDirectMetricoolDelivery(prepared,null,{...options,submit:async()=>({metricoolHandoff:{status:'accepted',postId:'not-proof'}})});
 assert.equal(accepted.scheduled,false);assert.equal(accepted.published,false);assert.equal(accepted.confirmationRequired,true);
 const fake=await runDirectMetricoolDelivery(prepared,null,{...options,submit:async()=>({metricoolHandoff:{status:'confirmed-scheduled',scheduled:true}})});
 assert.equal(fake.status,'confirmation-required');
});
test('source registration reuses the existing harvest API and rejects invented/cross-parcel content',async()=>{
 let body;
 await registerPreparedSource(candidate,{publisherUrl:'https://publisher.example',preparedAt:prepared.preparedAt,fetchImpl:async(url,init)=>{
  assert.equal(url,'https://publisher.example/api/garden/harvests/sync');body=JSON.parse(init.body);return Response.json({status:'ok',synced:1});
 }});
 assert.equal(body.harvests[0].id,candidate.harvestId);assert.equal(body.harvests[0].content,candidate.copy.text);assert.equal(body.harvests[0].parcelId,candidate.seedId);
 await assert.rejects(registerPreparedSource({...candidate,seedId:'yael-prospection'}),/NOT_VERIFIABLE/);
 await assert.rejects(registerPreparedSource({...candidate,parcelId:'other-client'}),/NOT_VERIFIABLE/);
 await assert.rejects(registerPreparedSource({...candidate,copy:{...candidate.copy,text:'invented'}}),/NOT_VERIFIABLE/);
});
test('illustrated fallback registers the exact project image and rejects mismatched media or network',async()=>{
 const illustrated=localEditorialCandidate('blacklace-dice');
 let source;
 await registerPreparedSource(illustrated,{publisherUrl:'https://publisher.example',preparedAt:prepared.preparedAt,fetchImpl:async(_url,init)=>{
  [source]=JSON.parse(init.body).harvests;
  return Response.json({status:'ok',synced:1});
 }});
 assert.equal(source.downloadUrl,illustrated.media.url);
 assert.equal(source.url,illustrated.editorialEvidence.source);
 const otherProject=localEditorialCandidate('blacklace-echo');
 await assert.rejects(registerPreparedSource({...illustrated,media:otherProject.media}),/NOT_VERIFIABLE/);
 await assert.rejects(registerPreparedSource({...illustrated,compatibleNetworks:['facebook']}),/NOT_VERIFIABLE/);
});

test('production prepares a sourced draft offline when the provider is unavailable, without Gmail or paid calls',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'gerard-direct-prepare-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await cp(new URL('../scripts/',import.meta.url),path.join(dir,'scripts'),{recursive:true});await mkdir(path.join(dir,'garden'));
 // A mail-sent receipt must not consume the publication itself.
 await writeFile(path.join(dir,'garden/gerard-metricool-production-history.json'),JSON.stringify({cursor:0,history:[]}));
 await writeFile(path.join(dir,'garden/gerard-metricool-fallback.json'),JSON.stringify({history:[{seedId:'blacklace-dice',text:localEditorialCandidate('blacklace-dice').copy.text,status:'mail-sent'}]}));
 await writeFile(path.join(dir,'block-network.mjs'),`import {appendFileSync} from 'node:fs';globalThis.fetch=async url=>{appendFileSync('network.txt',String(url)+'\\n');return Response.json({query:{pages:[]}});};`);
 await promisify(execFile)(process.execPath,['--import','./block-network.mjs','scripts/gerard-metricool-publication.mjs'],{cwd:dir,env:{...process.env,GERARD_METRICOOL_PREPARE_ONLY:'true',GERARD_METRICOOL_DIRECT_EXECUTION_ENABLED:'True',GERARD_METRICOOL_LOCAL_ONLY:'true',OCTOPUS_URL:'http://127.0.0.1:1',PUBLISHER_URL:'http://127.0.0.1:1'},timeout:15000});
 const p=JSON.parse(await readFile(path.join(dir,'garden/gerard-metricool-prepared.json')));
 assert.ok((await readFile(path.join(dir,'network.txt'),'utf8')).trim().split('\n').every(url=>new URL(url).hostname==='commons.wikimedia.org'));
 assert.equal(p.candidate.seedId,'blacklace-dice');assert.equal(p.candidate.copy.strategy,'local-editorial-sourced');
 assert.deepEqual(p.candidate.compatibleNetworks,['instagram']);
 assert.ok(p.candidate.media.url);
});


test('when direct scheduling is opted in, delivery does not substitute another Gmail-only proposal',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'gerard-direct-owner-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await cp(new URL('../scripts/',import.meta.url),path.join(dir,'scripts'),{recursive:true});await mkdir(path.join(dir,'garden'));
 await writeFile(path.join(dir,'garden/next-social-publication.json'),JSON.stringify(candidate));
 await writeFile(path.join(dir,'forbid-fetch.mjs'),"globalThis.fetch=()=>{throw Error('no transport should be called here')};");
 const {stdout}=await promisify(execFile)(process.execPath,['--import','./forbid-fetch.mjs','scripts/gerard-metricool-publication.mjs'],{cwd:dir,env:{...process.env,GERARD_METRICOOL_PREPARE_ONLY:'false',GERARD_METRICOOL_EXECUTION_ENABLED:'true',GERARD_METRICOOL_DIRECT_EXECUTION_ENABLED:'True'},timeout:5000});
 assert.equal(JSON.parse(stdout).metricoolTransport.owner,'production');
 assert.equal(await readFile(path.join(dir,'garden/next-social-publication.json'),'utf8'),JSON.stringify(candidate));
});
