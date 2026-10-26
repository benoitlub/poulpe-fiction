import test from "node:test";
import assert from "node:assert/strict";
import { GAME_URL, validateObservation, qualityDecision } from "../scripts/gerard-gameplay-capture.mjs";
const observations = { origin: GAME_URL, before: ["1","2","3"], rolls: [{ buttonClicked:true, animationObserved:true, faces:["4","2","3"] }] };
const video = { width:1080, height:1920, codec_name:"h264", duration:8 };
test("real dice event and animation required", () => {
 assert.equal(validateObservation(observations).status, "observed-gameplay");
 assert.throws(() => validateObservation({ ...observations, rolls:[{buttonClicked:true,animationObserved:true,faces:["1","2","3"]}] }), /UNCHANGED/);
 assert.throws(() => validateObservation({ ...observations, rolls:[{buttonClicked:true,animationObserved:false,faces:["4","2","3"]}] }), /UNVERIFIED/);
});
test("portrait MP4 and varied gameplay frames required", () => {
 assert.equal(qualityDecision({video,observations,distinctFrames:4}).creativeQuality,"human-review-required");
 assert.throws(() => qualityDecision({video,observations,distinctFrames:1}), /MOTION/);
 assert.throws(() => qualityDecision({video:{...video,width:1920},observations,distinctFrames:4}), /FORMAT/);
});
test("origin and evidence cannot be fabricated", () => {
 assert.throws(() => validateObservation({...observations,origin:"https://evil.invalid"}), /EVIDENCE/);
 assert.throws(() => validateObservation({...observations,rolls:[]}), /EVIDENCE/);
});
