// Deterministic simulation only. No real provider, email, publication or sale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {integrateLearningCycle,learningSelectionPolicy} from '../scripts/gerard-learning-cycle.mjs';
import {submitMetricoolPublication} from '../scripts/gerard-metricool-publication.mjs';
import {applyMetricoolFeedback} from '../scripts/gerard-social-feedback.mjs';
import {captureGarden,persistSnapshot,projectGarden,hydrateGarden} from '../scripts/gerard-private-runtime.mjs';

test('two actual selection cycles: failed delivery changes next choice after private snapshot round-trip',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'gerard-two-cycles-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await cp(new URL('../scripts/',import.meta.url),path.join(dir,'scripts'),{recursive:true});await mkdir(path.join(dir,'garden'));
 const candidates=['fixture-h1','fixture-h2'].map(harvestId=>({status:'ready',harvestId,seedId:'fixture-seed',parcelId:'fixture-parcel',title:'Simulation',copy:{text:harvestId},compatibleNetworks:['facebook'],provenance:{source:'deterministic-fixture'},production:{simulated:true}}));
 const requests=[];
 const server=createServer(async(req,res)=>{
  for await(const c of req){};const url=new URL(req.url,'http://localhost');requests.push(url);
  res.setHeader('Content-Type','application/json');
  if(url.pathname==='/api/social/bridge/next') {
   const excludes=(url.searchParams.get('excludeHarvestIds')??'').split(',');res.end(JSON.stringify(candidates.find(c=>!excludes.includes(c.harvestId))??{status:'empty'}));
  } else if(url.pathname==='/api/social/editorial/route')res.end(JSON.stringify({contract:'publisher-editorial-routing-v1',topic:'game',destination:{preferredProvider:'metricool'}}));
  else {res.statusCode=404;res.end('{}');}
 });server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const select=async()=>{
  await promisify(execFile)('bash',['scripts/gerard-social-selection.sh'],{cwd:dir,env:{...process.env,PUBLISHER_URL:`http://127.0.0.1:${server.address().port}`,GERARD_TENTACLE:'delivery'},timeout:20000});
  return {decision:JSON.parse(await readFile(path.join(dir,'garden/gerard-decision-explanation.json'))),candidate:JSON.parse(await readFile(path.join(dir,'garden/next-social-publication.json')))};
 };
 const one=await select();assert.equal(one.candidate.harvestId,'fixture-h1');
 const failed=await submitMetricoolPublication(one.candidate,{execute:true,fetchImpl:async()=>Response.json({status:'completed',output:{status:'failed',reason:'FIXTURE_TRANSPORT_FAILED'}})});
 const now=new Date().toISOString();
 const learning=integrateLearningCycle({memories:['retain']},one.decision,failed,{status:'unavailable'},{},now);
 assert.equal(learning.observations.at(-1).outcome,'transport-failed');
 assert.deepEqual(learningSelectionPolicy(learning).excludeHarvestIds,['fixture-h1']);
 await writeFile(path.join(dir,'garden/gerard-learning.json'),JSON.stringify(learning));
 const payload=await captureGarden(path.join(dir,'garden'));let row;
 const fakePg={query:async(sql,args)=>sql.startsWith('INSERT')?(row={version:1,payload:JSON.parse(args[0])},{rowCount:1,rows:[{version:1}]}):{rows:[row]}};
 await persistSnapshot(fakePg,payload,0);await projectGarden(path.join(dir,'garden'),payload);await hydrateGarden(path.join(dir,'garden'),row.payload);
 const two=await select();assert.equal(two.candidate.harvestId,'fixture-h2','must fail if real selector ignores persisted learning');
 assert.equal(two.decision.memoryAdaptation.evidence[0].outcome,'transport-failed');
 assert.equal(two.decision.memoryAdaptation.evidence[0].seedId,'fixture-seed');
 const receipt=await submitMetricoolPublication(two.candidate,{execute:true,fetchImpl:async()=>Response.json({status:'completed',output:{status:'confirmed-published',published:true,providerStatus:'published',postId:'fixture-post-2'}})});
 const cycle2=integrateLearningCycle(learning,two.decision,receipt,{}, {},now);
 assert.equal(cycle2.pendingExperiments.length,1);
 const measured=applyMetricoolFeedback(cycle2,{status:'available',source:'metricool-connected-analytics',posts:[{verified:true,network:'facebook',seedId:'fixture-seed',parcelId:'fixture-parcel',harvestId:'fixture-h2',text:'fixture-h2',url:'https://facebook.com/fixture-post-2',metrics:{reach:12}}]});
 assert.equal(measured.learning.completedExperiments.length,1);assert.equal(measured.learning.pendingExperiments.length,0);
 assert.equal(measured.learning.guidance.performanceRankingEnabled,false);
 assert.deepEqual(measured.learning.memories,['retain']);
 assert.equal(integrateLearningCycle(measured.learning,two.decision,receipt,{}, {},now).pendingExperiments.length,0,'completed experiment must not reopen on replay');
 // Counterfactual: the same selector without memory picks the original harvest.
 await writeFile(path.join(dir,'garden/gerard-learning.json'),'{}');await writeFile(path.join(dir,'garden/gerard-decision-history.json'),'[]');
 assert.equal((await select()).candidate.harvestId,'fixture-h1');
 assert.ok(requests.every(r=>['/api/social/bridge/next','/api/social/editorial/route'].includes(r.pathname)));
});

test('retry memory expires and stale or cross-parcel feedback cannot create success',()=>{
 const d={harvestId:'h1',seedId:'s1',parcelId:'p1'};
 const learning=integrateLearningCycle({},d,{harvestId:'h2',delivery:{status:'published',postId:'post'}},{},{},'2026-11-10T00:00:00Z');
 assert.equal(learning.observations[0].outcome,'not-verified');
 const failed=integrateLearningCycle({},d,{delivery:{status:'failed'}},{},{},'2026-11-10T00:00:00Z');
 assert.deepEqual(learningSelectionPolicy(failed,Date.parse('2026-11-10T03:00:00Z')).excludeHarvestIds,[]);
});

test('Notion retention distinguishes scheduling, publication receipts and unknown labels',async()=>{
 const {retainedObservation}=await import('../scripts/gerard-notion-memory.mjs');
 const base={kind:'gerard-experiment-cycle',seedId:'fixture',outcome:'transport-accepted'};
 assert.equal(retainedObservation({...base,delivery:{status:'published',postId:'fixture'}}),null);
 assert.match(retainedObservation({...base,delivery:{status:'confirmed-published',postId:'fixture',providerStatus:'published'}}).text,/Publication confirmée/);
 assert.match(retainedObservation({...base,delivery:{status:'confirmed-scheduled',postId:'fixture'}}).text,/Programmation confirmée/);
});

test('same harvest identifier across parcels cannot be attributed without scope',()=>{
 const pendingExperiments=['a','b'].map(p=>({key:p,harvestId:'shared',seedId:p,parcelId:p}));
 const post={verified:true,harvestId:'shared',network:'facebook',text:'fixture',url:'https://facebook.com/fixture',metrics:{reach:1}};
 const snapshot={status:'available',source:'metricool-connected-analytics',posts:[post]};
 assert.equal(applyMetricoolFeedback({pendingExperiments},snapshot).learning.completedExperiments.length,0);
 const scoped=applyMetricoolFeedback({pendingExperiments},{...snapshot,posts:[{...post,seedId:'a',parcelId:'a'}]}).learning;
 assert.equal(scoped.completedExperiments[0].parcelId,'a');assert.equal(scoped.pendingExperiments[0].parcelId,'b');
});
