export { studioMission } from "./gerard-av-studio.mjs";
import { runParcelStudio } from "./gerard-av-studio.mjs";
export const runVideoStudio = (seed, options = {}) =>
  runParcelStudio(seed, { ...options, kind: "video" });
