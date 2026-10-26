import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  studioMission,
  runParcelStudio,
  studioOperationId,
  studioFeedbackForParcel,
} from "../scripts/gerard-av-studio.mjs";
const seed = {
  seedId: "s-new",
  parcelId: "another-project",
  title: "Autre jeu",
  objective: "Objectif propre à cette parcelle",
  templates: [
    { id: "image-studio", config: { assetId: "own-media" } },
    {
      id: "audio-studio",
      config: {
        segments: [
          {
            text: "Texte propre au projet.",
            caption: "Texte propre au projet.",
          },
        ],
        scriptRights: {
          source: "https://example.org/source",
          attribution: "Autre auteur",
        },
      },
    },
    { id: "video-studio", config: { durationSeconds: 12 } },
  ],
};
test("templates create a neutral mission without any hardcoded product or provider spending", async () => {
  const m = await studioMission(seed, "video", "op");
  assert.equal(m.context.id, seed.parcelId);
  assert.equal(m.context.metadata.studioRequest.assetId, "own-media");
  assert.equal(m.context.metadata.studioRequest.durationSeconds, 12);
  assert.deepEqual(m.authorizedResources, ["video.studio"]);
  assert.equal(m.context.metadata.studioRequest.automaticPublication, false);
  assert.equal(
    await studioMission({ ...seed, templates: [] }, "video", "op"),
    null,
  );
  const first = studioOperationId(seed, "video");
  assert.equal(first, studioOperationId(seed, "video"));
  assert.notEqual(
    first,
    studioOperationId({ ...seed, title: "Autre angle" }, "video"),
  );
});
test("registered gameplay clip replaces image and Mistral without cross-parcel injection", async () => {
  const configured = {
    ...seed,
    templates: [
      { id: "image-studio", config: { assetId: "own-media", subject: "Do not call Mistral", allowMistralImage: true } },
      seed.templates[1],
      { id: "video-studio", config: { durationSeconds: 12, videoAssetId: "registered-own-gameplay-01" } },
    ],
  };
  const mission = await studioMission(configured, "video", "gameplay-01");
  const request = mission.context.metadata.studioRequest;
  assert.equal(request.videoAssetId, "registered-own-gameplay-01");
  assert.equal(request.assetId, undefined);
  assert.equal(request.imagePrompt, undefined);
  assert.deepEqual(mission.authorizedResources, ["video.studio"]);
  assert.equal(request.automaticPublication, false);
  assert.notEqual(studioOperationId(seed, "video"), studioOperationId(configured, "video"));
});
test("external generation is never inferred from template defaults or connected accounts", async () => {
  const m = await studioMission(
    {
      ...seed,
      templates: [
        {
          id: "audio-studio",
          config: { allowMistralText: true, knowledge: "Source vérifiée" },
        },
      ],
    },
    "audio",
    "op",
  );
  assert.deepEqual(m.authorizedResources, ["audio.studio", "mistral.text"]);
  assert.ok(!m.authorizedResources.includes("social.publish"));
});
test("missing file, incomplete mission and cross-parcel success cannot become an archive", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "av-client-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const output of [
    { status: "rendering" },
    { status: "ready-for-review" },
  ]) {
    const out = await runParcelStudio(seed, {
      operationId: "op",
      outputDir: dir,
      submit: async () => ({ status: "waiting-authorization", output }),
    });
    assert.equal(out.status, "blocked");
  }
  await assert.rejects(
    runParcelStudio(seed, {
      operationId: "op",
      outputDir: dir,
      submit: async () => ({
        status: "completed",
        output: { status: "ready-for-review", parcelId: "foreign" },
      }),
    }),
    /identity-mismatch/,
  );
});
test("downloads and hashes actual bytes, rejects tampering, and preserves a verified archive across cycles", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "av-client-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bytes = Buffer.from("UNIT TEST IMAGE BYTES ONLY, decoder is injected"),
    sha = createHash("sha256").update(bytes).digest("hex");
  let calls = 0;
  const report = {
    status: "ready-for-review",
    parcelId: seed.parcelId,
    seedId: seed.seedId,
    operationId: "op",
    published: false,
    files: [{ filename: "image.png", bytes: bytes.length, sha256: sha }],
    artifact: {
      filename: "image.png",
      sha256: sha,
      downloadUrl:
        "/api/production/studio/artifacts/" + "a".repeat(64) + "/image.png",
    },
  };
  const opts = {
    kind: "image",
    operationId: "op",
    outputDir: dir,
    submit: async () => {
      calls++;
      return { status: "completed", output: report };
    },
    download: async () => bytes,
    verifyFile: async () => {},
  };
  await assert.rejects(
    runParcelStudio(seed, {
      ...opts,
      download: async () => Buffer.from("corrupted"),
    }),
    /hash-mismatch/,
  );
  const a = await runParcelStudio(seed, opts);
  assert.equal(a.status, "ready-for-review");
  assert.equal(
    (await readFile(path.join(dir, "image.png"))).toString(),
    bytes.toString(),
  );
  const b = await runParcelStudio(seed, {
    ...opts,
    submit: async () => {
      throw new Error("must use verified local archive");
    },
  });
  assert.equal(b.reused, true);
  assert.equal(calls, 2);
});

test("transmits only approved parcel-specific video guidance and changes cache identity", async () => {
  const learning = { guidance: { ownerCreativeFeedback: [
    { feedbackId: "review-420", parcelId: "another-project", assetType: "short-video",
      creativeGuidance: ["Move the camera", "Animate the dice"], prohibitedActions: ["Do not publish"] },
    { feedbackId: "foreign", parcelId: "other", assetType: "short-video",
      creativeGuidance: ["Unrelated direction"] },
    { feedbackId: "audio", parcelId: "another-project", assetType: "audio",
      creativeGuidance: ["Unrelated direction"] },
  ] } };
  const guidance = studioFeedbackForParcel(learning, seed.parcelId);
  assert.equal(guidance.length, 1);
  assert.equal(guidance[0].feedbackId, "review-420");
  assert.deepEqual(studioFeedbackForParcel(learning, seed.parcelId, "audio"), []);
  const mission = await studioMission(seed, "video", "new-operation", guidance);
  assert.deepEqual(mission.context.metadata.studioRequest.creativeFeedback, guidance);
  assert.equal(mission.context.metadata.studioRequest.automaticPublication, false);
  assert.notEqual(studioOperationId(seed, "video"), studioOperationId(seed, "video", guidance));
  assert.equal(studioOperationId(seed, "video", guidance), studioOperationId(seed, "video", guidance));
});
