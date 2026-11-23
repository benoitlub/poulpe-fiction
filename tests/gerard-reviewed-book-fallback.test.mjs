import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedBookCandidate, prepareReviewedBook} from '../scripts/gerard-reviewed-book-fallback.mjs';
import {metricoolMission} from '../scripts/gerard-metricool-publication.mjs';
const options={publisherUrl:'https://publisher.example'};
test('book recovery uses official existing covers and author Buffer route without AI or Metricool', async()=>{
 const calls=[];
 const c=await prepareReviewedBook([], {...options,fetchImpl:async(url,init)=>{
  calls.push(String(url));assert.equal(init.method,'POST');assert.equal(JSON.parse(init.body).seedId,'terra');
  return Response.json({status:'ready-for-controlled-test',topic:'book',channelId:'6ac8c8226a5c39ccb65fdbf6'});
 }});
 assert.deepEqual(calls,['https://publisher.example/api/social/transports/buffer/book-preflight']);
 assert.equal(c.copy.strategy,'reviewed-book-recovery');assert.equal(c.media.official,true);
 assert.match(c.copy.text,/B0H4CN5MSH/);assert.match(c.media.url,/books\/terra\//);
 assert.equal(c.delivery.publishingEnabled,false);assert.equal(metricoolMission(c),null);
});
test('confirmed copies advance to the next book; pending writes keep the stable reservation key',()=>{
 const first=reviewedBookCandidate();
 const receipt={harvestId:first.harvestId,status:'confirmed-scheduled',postId:'post-1'};
 const second=reviewedBookCandidate([receipt]);
 assert.equal(second.seedId,'gerard-et-gerard');assert.match(second.copy.text,/B0H68811RL/);
 assert.equal(reviewedBookCandidate([receipt,{harvestId:second.harvestId,status:'confirmed-published',postId:'post-2'}]),null);
 assert.equal(reviewedBookCandidate([{...receipt,status:'unknown'}]).harvestId,first.harvestId);
 assert.equal(reviewedBookCandidate([{copyText:first.copy.text,mediaUrl:first.media.url,status:'confirmed-published',postId:'other-harvest'}]).seedId,'gerard-et-gerard');
});
test('wrong account, failed preflight and non-HTTPS publisher cannot prepare a publishable package',async()=>{
 for(const body of [{status:'blocked'}, {status:'ready-for-controlled-test',topic:'book',channelId:'wrong-channel'}]) {
  await assert.rejects(prepareReviewedBook([],{...options,fetchImpl:async()=>Response.json(body)}),/preflight-unavailable/);
 }
 await assert.rejects(prepareReviewedBook([],{publisherUrl:'http://publisher.example',fetchImpl:async()=>{throw Error('must not fetch')}}),/https-required/);
});
