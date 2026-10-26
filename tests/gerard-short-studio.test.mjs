import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planShort, ffmpegArguments } from '../scripts/gerard-short-studio.mjs';

const template = JSON.parse(await readFile(new URL('../templates/short-studio.v1.json', import.meta.url), 'utf8'));
const seed = { seedId: 'terra', parcelId: 'poulpe-fiction', templates: [{
  id: 'short-studio', config: { title: 'TERRA teaser', narrationAudio: '/tmp/voice.wav',
    scenes: [{ image: '/tmp/one.png', seconds: 3 }, { image: '/tmp/two.png', seconds: 4 }] },
}] };

test('a reusable parcel template produces a vertical narrated MP4 plan without publishing', () => {
  const plan = planShort(seed, template);
  assert.equal(plan.duration, 7);
  assert.equal(plan.publishingEnabled, false);
  const args = ffmpegArguments(plan, '/tmp/short.mp4');
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('aac'));
  assert.ok(args.some(arg => arg.includes('scale=1080:1920')));
  assert.equal(args.at(-1), '/tmp/short.mp4');
});

test('music requires explicit license evidence', () => {
  const withMusic = structuredClone(seed);
  withMusic.templates[0].config.musicAudio = '/tmp/music.wav';
  assert.throws(() => planShort(withMusic, template), /music-license-not-verified/);
  withMusic.templates[0].config.musicLicenseVerified = true;
  assert.ok(ffmpegArguments(planShort(withMusic, template), '/tmp/short.mp4').includes('-stream_loop'));
});

test('no remote assets, overlong scenes or unconfigured parcel slip through', () => {
  assert.equal(planShort({ seedId: 'terra', parcelId: 'p' }, template), null);
  const bad = structuredClone(seed);
  bad.templates[0].config.scenes[0].image = 'https://example.com/a.png';
  assert.throws(() => planShort(bad, template), /must-be-local-file/);
  bad.templates[0].config.scenes[0].image = '/tmp/a.png';
  bad.templates[0].config.scenes[0].seconds = 90;
  assert.throws(() => planShort(bad, template), /invalid-scene-duration/);
});
