#!/usr/bin/env node
/** Bounded analytics read with explicit timeout and retry evidence. */
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const base=(process.env.PUBLISHER_URL || '').replace(/\/$/,'');
const endpoint='/api/observatory/capability-gap?capability=analytics.read&mission=social%20media%20facebook%20instagram%20post%20engagement%20reach';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function probePublisher(fetchImpl=fetch, sleep=wait) {
 let last={ status:'unavailable', reason:'not-attempted' };
 for(let attempt=1;attempt<=2;attempt++) {
  try {
   const response=await fetchImpl(base+endpoint,{signal:AbortSignal.timeout(12000)});
   if(!response.ok) {last={status:'unavailable',httpStatus:response.status,reason:'publisher-http-error'}; if(response.status<500 && response.status!==429) break;}
   else {const body=await response.json(); if(body && typeof body==='object' && !Array.isArray(body)) return {observedAt:new Date().toISOString(),source:'publisher',capability:'analytics.read',status:'received',attempts:attempt,response:body}; last={status:'unavailable',reason:'invalid-response'};}
  } catch(e) {last={status:'unavailable',reason:e.name==='TimeoutError'?'timeout':'network-error'};}
  if(attempt===1) await sleep(700);
 }
 return {observedAt:new Date().toISOString(),source:'publisher',capability:'analytics.read',attempts:2,...last};
}
if(process.argv[1] && import.meta.url===new URL('file://'+resolve(process.argv[1])).href) {
 const result=await probePublisher();
 await mkdir('garden',{recursive:true});
 await writeFile('garden/gerard-publisher-advice.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({source:result.source,capability:result.capability,status:result.status,reason:result.reason??null,attempts:result.attempts}));
}
