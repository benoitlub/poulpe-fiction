import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
async function scenario(t,output,{missionStatus="completed",twice=false}={}){
 const root=await mkdtemp(join(tmpdir(),"gerard-b2b-"));await mkdir(join(root,"scripts"));await mkdir(join(root,"garden"));
 for(const name of ["gerard-cycle.mjs","gerard-compost.mjs"])await copyFile(new URL(`../scripts/${name}`,import.meta.url),join(root,"scripts",name));
 await writeFile(join(root,"garden/restart-seeds.json"),JSON.stringify({seeds:[{seedId:"benoit-client-acquisition",parcelId:"benoit-business-growth",title:"Partenaires Pro.Hibited",status:"active",objective:"Rechercher des sources B2B publiques",delivery:{harvestState:"ready-to-offer"}}]}));
 await writeFile(join(root,"garden/gerard-state.json"),"{}");await writeFile(join(root,"garden/harvests.json"),'{"harvests":[]}');
 const calls=[];const server=createServer(async(req,res)=>{let raw="";for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);calls.push(body);assert.equal(req.url,"/mission");assert.deepEqual(body.requiredCapabilities,["business.sources.search"]);assert.deepEqual(body.authorizedResources,["tools.read"]);assert.equal(body.context.metadata.toolRequest.dryRun,false);res.setHeader("Content-Type","application/json");res.end(JSON.stringify({status:missionStatus,output:{capability:"business.sources.search",...output}}));});
 server.listen(0,"127.0.0.1");await once(server,"listening");t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
 let exit=0;
 for(let i=0;i<(twice?2:1);i++){try{await promisify(execFile)(process.execPath,[join(root,"scripts/gerard-cycle.mjs")],{cwd:root,env:{...process.env,GERARD_MODE:"cultivate",OCTOPUS_URL:`http://127.0.0.1:${server.address().port}`,PUBLISHER_URL:"http://unexpected.invalid"},timeout:10000});}catch(e){exit=e.code;}}
 return {state:JSON.parse(await readFile(join(root,"garden/gerard-state.json"),"utf8")),harvests:JSON.parse(await readFile(join(root,"garden/harvests.json"),"utf8")).harvests,calls,exit};
}
test("B2B sources create an honest harvest without internal Notion/LLM; identical next cycle reuses it",async t=>{
 const out=await scenario(t,{status:"sources-found",executed:true,selectedTool:"FIXTURE_DISCOVERED_SEARCH",candidates:[{title:"Société de test",url:"https://fixture.example.org/contact",snippet:"Résultat de recherche simulé"}]},{twice:true});
 assert.equal(out.exit,0);assert.equal(out.harvests.length,1);assert.equal(out.calls.length,2);assert.equal(out.harvests[0].state,"harvested");assert.equal(out.harvests[0].verification.qualifiedProspects,0);assert.equal(out.state.lastResult.decision,"b2b-sources-produced");assert.equal(out.state.lastResult.knowledge.verified,false);assert.equal(out.state.lastResult.persistedHarvest.reused,true);
});
test("connection failure and quota error keep their reason and never create a harvest",async t=>{
 for(const reason of ["NO_ACTIVE_CONNECTION","COMPOSIO_RATE_LIMITED"]){const out=await scenario(t,{status:"blocked",reason,candidates:[],executed:false},{missionStatus:"needs-input"});assert.equal(out.exit,1);assert.equal(out.harvests.length,0);assert.equal(out.state.lastResult.decision,"b2b-source-blocked");assert.equal(out.state.lastResult.businessSourceLookup.reason,reason);assert.equal(out.state.learningHistory.at(-1).error,reason);}
});
test("empty search, preview and incomplete Octopus result cannot masquerade as prospects",async t=>{
 for(const [output,missionStatus]of [[{status:"no-sources",executed:true,candidates:[]},"completed"],[{status:"ready-to-read",executed:false,candidates:[]},"completed"],[{status:"sources-found",executed:true,candidates:[{title:"Incomplete",url:"https://fixture.example.org/"}]},"needs-input"]]){const out=await scenario(t,output,{missionStatus});assert.equal(out.exit,1);assert.equal(out.harvests.length,0);assert.equal(out.state.lastResult.status,"failed");}
});

test("provider Retry-After suspends that seed instead of searching again on the next cycle",async t=>{
 const out=await scenario(t,{status:"blocked",reason:"COMPOSIO_RATE_LIMITED",retryAfterSeconds:3600,candidates:[],executed:false},{missionStatus:"needs-input",twice:true});
 assert.equal(out.calls.length,1);assert.equal(out.harvests.length,0);assert.equal(out.state.lastResult.decision,"source-quota-deferred");assert.equal(out.state.lastResult.executed,false);assert.equal(out.state.lastResult.verifiedProspects,0);
});
