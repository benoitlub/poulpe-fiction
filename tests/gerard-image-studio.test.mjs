import test from 'node:test';
import assert from 'node:assert/strict';
import { imageStudioConfig, imageStudioPrompt } from '../scripts/gerard-image-studio.mjs';
const template={defaults:{aspectRatio:'9:16',style:'promotional'}};
const seed={seedId:'a',parcelId:'parcel-a',templates:[{id:'image-studio',enabled:true,config:{subject:'Original dice game'}}]};
test('only declared template enables image studio',()=>{assert.equal(imageStudioConfig({...seed,templates:[]},template),null);assert.equal(imageStudioConfig(seed,template).parcelId,'parcel-a');});
test('parcel prompt includes its own subject and format',()=>{const prompt=imageStudioPrompt(imageStudioConfig(seed,template));assert.match(prompt,/Original dice game/);assert.match(prompt,/9:16/);});
test('missing subject is rejected',()=>assert.throws(()=>imageStudioConfig({...seed,templates:[{id:'image-studio',config:{}}]},template),/subject-required/));
