export { studioMission } from "./gerard-av-studio.mjs";
import { runParcelStudio } from "./gerard-av-studio.mjs";
export const runAudioStudio = (seed, options = {}) =>
  runParcelStudio(seed, { ...options, kind: "audio" });
