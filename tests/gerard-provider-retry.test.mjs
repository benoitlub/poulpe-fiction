import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { providerRetry } from '../scripts/gerard-provider-retry.mjs';
import { runImageStudio } from '../scripts/gerard-image-studio.mjs';
import { runParcelStudio } from '../scripts/gerard-av-studio.mjs';
const seed={seedId:'s',parcelId:'p',title:'Fixture',templates:[{id:'image-studio',config:{subject:'Fixture',allowMistralImage:true}}]};
test('Retry-After seconds and HTTP date are minimum waits; 429 type stays unknown',()=>{
 const now=Date.parse('2026-11-08T00:00:00Z');
 for(const retryAfter of ['120','Sun, 08 Nov 2026 00:02:00 GMT']) {
  const r=providerRetry({httpStatus:429,retryAfter},now);
  assert.equal(r.retryAt,'2026-11-08T00:02:00.000Z');assert.equal(r.limitType,'unknown');
 }
 assert.equal(providerRetry({status:503},now),null);
 assert.equal(providerRetry({status:429,retryAfter:'invalid'},now).retryAt,'2026-11-08T00:15:00.000Z');
});
for(const studio of ['direct','mission'])test(`${studio}: 429 persists, no repeat before expiry, resumes afterwards`,async t=>{
 const outputDir=await mkdtemp(path.join(tmpdir(),'gerard-retry-'));t.after(()=>rm(outputDir,{recursive:true,force:true}));
 let clock=1000000,calls=0;
 const request=async()=>{calls++;throw Object.assign(new Error('limited'),{httpStatus:429,retryAfter:'120'});};
 const opts={outputDir,now:()=>clock,operationId:'op',kind:'image',request,submit:request,download:async()=>{throw Error('must not download');}};
 const run=()=>studio==='direct'?runImageStudio(seed,{...opts,submit:undefined}):runParcelStudio(seed,opts);
 assert.equal((await run()).status,'deferred');
 clock+=119999;assert.equal((await run()).status,'deferred');assert.equal(calls,1);
 clock++;await run();assert.equal(calls,2);
});
test('declared generation without fileId cannot be downloaded or published',async t=>{
 const outputDir=await mkdtemp(path.join(tmpdir(),'gerard-no-file-'));t.after(()=>rm(outputDir,{recursive:true,force:true}));
 let requests=0;
 const opts={outputDir,request:async()=>{requests++;return {status:'generated',result:{}};},download:async()=>{throw Error('must not download');}};
 assert.equal((await runImageStudio(seed,opts)).status,'failed');
 assert.equal((await runImageStudio(seed,opts)).status,'failed');assert.equal(requests,2);
});
test('generated file is recovered and decoded; interrupted retrieval does not generate again',async t=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const {readFile}=await import('node:fs/promises');
 const outputDir=await mkdtemp(path.join(tmpdir(),'gerard-image-bytes-'));t.after(()=>rm(outputDir,{recursive:true,force:true}));
 const fixture=path.join(outputDir,'fixture.png');
 await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','testsrc=size=320x480','-frames:v','1','-threads','1',fixture]);
 const bytes=await readFile(fixture);let calls=0;
 const opts={outputDir,request:async()=>{calls++;return {status:'generated',result:{fileId:'fixture-only'}};},download:async()=>bytes};
 await assert.rejects(runImageStudio(seed,{...opts,download:async()=>{throw Error('interrupted');}}),/interrupted/);
 const result=await runImageStudio(seed,opts);
 assert.equal(calls,1);assert.equal(result.verifiedFile,true);assert.equal(result.width,320);
 assert.equal(result.published,false);assert.equal(result.evidence.readyForDiffusion,false);
 assert.equal((await readFile(path.join(outputDir,result.filename))).length,bytes.length);
});
test('uncertain provider outcome cannot silently become an automatic paid retry',async t=>{
 const outputDir=await mkdtemp(path.join(tmpdir(),'gerard-uncertain-'));t.after(()=>rm(outputDir,{recursive:true,force:true}));
 let calls=0;
 const opts={outputDir,operationId:'op',kind:'image',submit:async()=>{calls++;return {status:'needs-input',output:{status:'failed',code:'MISTRAL_IMAGE_NETWORK_FAILED',httpStatus:429,providerOutcomeMayBeUnknown:true,retryAllowed:false}};}};
 assert.equal((await runParcelStudio(seed,opts)).status,'blocked');
 assert.equal((await runParcelStudio(seed,opts)).status,'blocked');assert.equal(calls,1);
});
