import test from "node:test";
import assert from "node:assert/strict";
import {
  imageStudioConfig,
  imageStudioPrompt,
  runImageStudio,
} from "../scripts/gerard-image-studio.mjs";

import {
  mkdtemp,
  mkdir,
  copyFile,
  readdir,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const template = { defaults: { aspectRatio: "9:16", style: "promotional" } };
const seed = {
  seedId: "a",
  parcelId: "parcel-a",
  templates: [
    {
      id: "image-studio",
      enabled: true,
      config: { subject: "Original dice game" },
    },
  ],
};
test("only declared template enables image studio", () => {
  assert.equal(imageStudioConfig({ ...seed, templates: [] }, template), null);
  assert.equal(imageStudioConfig(seed, template).parcelId, "parcel-a");
});
test("parcel prompt includes its own subject and format", () => {
  const prompt = imageStudioPrompt(imageStudioConfig(seed, template));
  assert.match(prompt, /Original dice game/);
  assert.match(prompt, /9:16/);
});
test("missing subject is rejected", () =>
  assert.throws(
    () =>
      imageStudioConfig(
        { ...seed, templates: [{ id: "image-studio", config: {} }] },
        template,
      ),
    /subject-required/,
  ));
test("the real cycle never turns an explicit image spending refusal into permission", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "image-permission-audit-"));
  await mkdir(path.join(root, "scripts"));
  await mkdir(path.join(root, "garden"));
  await mkdir(path.join(root, "templates"));
  for (const name of await readdir(new URL("../scripts/", import.meta.url)))
    if (name.endsWith(".mjs"))
      await copyFile(
        new URL("../scripts/" + name, import.meta.url),
        path.join(root, "scripts", name),
      );
  for (const name of ["image-studio.v1.json"])
    await copyFile(
      new URL("../templates/" + name, import.meta.url),
      path.join(root, "templates", name),
    );
  await writeFile(
    path.join(root, "garden/restart-seeds.json"),
    JSON.stringify({
      seeds: [
        {
          ...seed,
          knowledgeSlug: "fixture-context",
          templates: [
            {
              id: "image-studio",
              config: { subject: "Own parcel", allowMistralImage: false },
            },
          ],
        },
      ],
    }),
  );
  await writeFile(path.join(root, "garden/gerard-state.json"), "{}");
  await writeFile(path.join(root, "garden/harvests.json"), '{"harvests":[]}');
  const missions = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    if (req.url === "/mission") {
      missions.push(JSON.parse(body));
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "waiting-authorization",
          output: { status: "blocked", code: "FIXTURE_BLOCKED" },
        }),
      );
    } else {
      res.writeHead(404);
      res.end("{}");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await promisify(execFile)(
      process.execPath,
      [path.join(root, "scripts/gerard-cycle.mjs")],
      {
        cwd: root,
        timeout: 15000,
        env: {
          ...process.env,
          GERARD_MODE: "cultivate",
          GERARD_IMAGE_STUDIO_ENABLED: "true",
          GERARD_AV_STUDIO_ENABLED: "false",
          OCTOPUS_URL: base,
          PUBLISHER_URL: base,
          LOCAL_PUBLISHER_URL: base,
        },
      },
    );
  } catch (e) {
    assert.equal(e.code, 1);
  }
  const image = missions.find((m) =>
    m.requiredCapabilities?.includes("image.studio"),
  );
  assert.ok(image, "the actual cycle must submit the image request");
  assert.deepEqual(image.authorizedResources, ["image.studio"]);
  assert.ok(
    !missions.some((m) => m.requiredCapabilities?.includes("social.publish")),
  );
});

test("the historical callback path also honors the template spending refusal", async () => {
  let called = false;
  const r = await runImageStudio(
    {
      ...seed,
      templates: [
        {
          id: "image-studio",
          config: { subject: "Own project", allowMistralImage: false },
        },
      ],
    },
    {
      request: async () => {
        called = true;
        throw new Error("must not execute provider");
      },
      download: async () => Buffer.alloc(0),
      outputDir: "/unused",
    },
  );
  assert.equal(r.status, "blocked");
  assert.equal(called, false);
  const allowed = await runImageStudio(
    {
      ...seed,
      templates: [
        {
          id: "image-studio",
          config: { subject: "Own project", allowMistralImage: true },
        },
      ],
    },
    {
      request: async () => {
        called = true;
        return { status: "failed" };
      },
      download: async () => Buffer.alloc(0),
      outputDir: "/unused",
    },
  );
  assert.equal(called, true);
  assert.equal(allowed.status, "failed");
});
