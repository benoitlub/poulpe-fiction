#!/usr/bin/env node
/** Read-only Publisher -> Gérard creative pack intake.
 * Never installs skills, runs external tools, posts content, or triggers an LLM.
 */
import {writeFile,mkdir} from "node:fs/promises";
const base=(process.env.PUBLISHER_URL||"https://blacklace-publisher-worker.benoitlubert.workers.dev").replace(/\/$/,"");
const out=new URL("../garden/gerard-creative-tool-packs.json",import.meta.url);
const ids=["gerard-explorer-playwright","gerard-art-direction","gerard-impeccable-quality","gerard-media-blender"];
const report={contract:"gerard-creative-tool-intake-v1",observedAt:new Date().toISOString(),source:"Publisher Observatory",status:"unverified",execution:"read-only",autoInstall:false,autoPublish:false,items:[]};
try{
  const res=await fetch(base+"/api/observatory/sources?limit=500",{signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw new Error("Publisher HTTP "+res.status);
  const data=await res.json();
  if(!Array.isArray(data.sources))throw new Error("Publisher source inventory unavailable");
  for(const id of ids){
    const item=data.sources.find(x=>x?.pack?.details?.id===id || x?.pack?.details?.id===id || String(x?.value||"").includes("#"+id));
    const candidate=item?.pack?.details;
    const valid=item && candidate?.id===id && item.pack?.state==="proposed-not-executed";
    report.items.push({id,status:valid?"prepared":"not-verified",title:valid?candidate.title:null,
      capabilities:valid?candidate.capabilities:[],deliverables:valid?candidate.deliverables:[],
      executionEnabled:false,provenance:valid?String(item.value):null});
  }
  report.status=report.items.every(x=>x.status==="prepared")?"prepared":"partial";
}catch(err){
  report.status="unavailable";
  report.error=err instanceof Error?err.message:"Unknown error";
  report.items=ids.map(id=>({id,status:"not-verified",executionEnabled:false}));
}
await mkdir(new URL("../garden/",import.meta.url),{recursive:true});
await writeFile(out,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({event:"gerard.publisher-tool-intake",status:report.status,items:report.items.map(x=>({id:x.id,status:x.status})),externalActions:0}));
