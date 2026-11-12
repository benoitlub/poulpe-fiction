import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { relayProhibitedStudio } from '../scripts/gerard-prohibited-metricool-relay.mjs';

const tag = 'gerard-prohibited-online-studio-v1';
const url = 'https://github.com/benoitlub/poulpe-fiction/releases/download/' + tag + '/prohibited-online-studio-v1.mp4';
const bytes = Buffer.concat([Buffer.from([0,0,0,20]), Buffer.from('ftypisom'), Buffer.from('00000000')]);
const release = { draft:false, tag_name:tag, assets:[{
  name:'prohibited-online-studio-v1.mp4',state:'uploaded',browser_download_url:url,
  digest:'sha256:'+createHash('sha256').update(bytes).digest('hex'),size:bytes.length,
}] };
const fetchImpl = async input => String(input).includes('/releases/tags/')
  ? {ok:true,status:200,json:async()=>release}
  : {ok:true,status:200,body:(async function*(){yield bytes})()};

test('Studio relay remains Instagram-only by default', async () => {
  const prior=process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED;
  delete process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED;
  try {
    const calls=[];
    const result=await relayProhibitedStudio({fetchImpl,handoff:async c=>{
      calls.push(c);return {metricoolHandoff:{status:'mail-sent'}};
    }});
    assert.equal(result.status,'mail-sent');
    assert.equal(calls.length,1);
    assert.deepEqual(calls[0].compatibleNetworks,['instagram']);
    assert.equal(calls[0].transport.brandId,'3350145');
  } finally {
    if(prior===undefined) delete process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED;
    else process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED=prior;
  }
});

test('Explicit opt-in reuses verified MP4 with independent TikTok destination', async () => {
  const prior=process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED;
  process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED='true';
  try {
    const calls=[];
    const result=await relayProhibitedStudio({fetchImpl,handoff:async c=>{
      calls.push(c);return {metricoolHandoff:{status:'mail-sent'}};
    }});
    assert.equal(result.status,'relays-handed-off');
    assert.equal(calls.length,2);
    assert.equal(calls[0].media.url,calls[1].media.url);
    assert.notEqual(calls[0].harvestId,calls[1].harvestId);
    assert.deepEqual(calls[1].compatibleNetworks,['tiktok']);
    assert.equal(calls[1].transport.brandId,'7653100');
  } finally {
    if(prior===undefined) delete process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED;
    else process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED=prior;
  }
});

test('Failed Instagram relay does not hand off TikTok', async () => {
  const prior=process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED;
  process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED='true';
  try {
    let calls=0;
    const result=await relayProhibitedStudio({fetchImpl,handoff:async()=>{
      calls++;return {metricoolHandoff:{status:'mail-unconfirmed'}};
    }});
    assert.equal(result.status,'blocked');
    assert.equal(result.reason,'INSTAGRAM_RELAY_UNCONFIRMED');
    assert.equal(calls,1);
  } finally {
    if(prior===undefined) delete process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED;
    else process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED=prior;
  }
});

test('Missing Studio export cannot hand off to any network', async () => {
  let calls=0;
  const result=await relayProhibitedStudio({fetchImpl:async()=>({status:404}),handoff:async()=>{calls++;}});
  assert.equal(result.status,'awaiting-studio-export');
  assert.equal(calls,0);
});
