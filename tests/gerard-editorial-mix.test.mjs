import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialMix, suggestEditorialCategory, classifyExperimentObservation } from '../scripts/gerard-editorial-mix.mjs';
import { integrateLearningCycle } from '../scripts/gerard-learning-cycle.mjs';

test('60/25/15 counts originals only, without touching queued assets', () => {
  const existing = [{id:'a',category:'entertainment',status:'queued'}, {id:'b',originalId:'a',category:'entertainment',status:'published'}, {id:'c',category:'behindTheScenes'}];
  const before = JSON.stringify(existing);
  const result = editorialMix(existing);
  assert.deepEqual(result.counts, {entertainment:1,behindTheScenes:1,promotion:0});
  assert.equal(result.measured,2);
  assert.equal(result.queueChanges,0);
  assert.equal(JSON.stringify(existing),before);
});
test('category guidance does not gate publishing', () => {
  const result = integrateLearningCycle({editorialAssets:[]}, {}, {}, {}, {});
  assert.equal(result.guidance.editorialExperiment.mix.advisoryOnly,true);
  assert.equal(result.guidance.editorialExperiment.status,'advisory');
  assert.equal(result.guidance.editorialExperiment.suggestedCategory,'entertainment');
  assert.equal(suggestEditorialCategory([]),'entertainment');
});
test('unverified analytics are inconclusive',()=>{
  assert.equal(classifyExperimentObservation({metrics:{reach:123}}),'inconclusive');
  assert.equal(classifyExperimentObservation({verified:true,transportId:'h1',metrics:{reach:0}}),'measured-not-causal');
});
