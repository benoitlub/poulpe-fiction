const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const artifactDir = process.env.GEGE_ARTIFACTS || "/tmp/gege-artifacts";
mkdirSync(artifactDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  let errors = [];
  let writes = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.method() + " " + r.url());
  });
  await page.goto(process.env.GEGE_PREVIEW_URL || "http://localhost:4174");
  await page.getByText("DONNÉES FICTIVES", { exact: true }).waitFor();
  assert.equal(await page.locator(".worker").count(), 7);
  await page.screenshot({
    path: join(artifactDir, "desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Greffeur : Réparer une écluse, Échouée" })
    .click();
  await page
    .getByRole("button", { name: "Simuler une reprise fictive" })
    .click();
  assert.match(await page.locator("aside").innerText(), /Reprise en cours/);
  await page
    .getByRole("button", { name: "Simuler une réussite fictive" })
    .click();
  assert.match(await page.locator("aside").innerText(), /Échouée/); // Historical failure retained.
  assert.match(await page.locator("aside").innerText(), /Terminée/);
  await page
    .getByRole("button", { name: "Traces réelles", exact: true })
    .click();
  await page.getByText("INSTANTANÉ RÉEL", { exact: true }).waitFor();
  assert.equal(await page.locator(".worker").count(), 12);
  assert.equal(
    await page.getByText("DONNÉES FICTIVES", { exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Vue synthétique", exact: true })
    .click();
  assert.ok((await page.locator(".mission-row").count()) > 0);
  await page.getByLabel("Métier", { exact: true }).selectOption("enlumineur");
  await page.getByText("Aucune mission ne correspond à ces filtres.").waitFor();
  await page.getByLabel("Métier", { exact: true }).selectOption("");
  await page.route("**/snapshot.json", (route) => route.abort());
  await page.getByRole("button", { name: "Relire", exact: true }).click();
  await page.getByText("HORS LIGNE", { exact: true }).waitFor();
  assert.ok((await page.locator(".mission-row").count()) > 0);
  await page.unroute("**/snapshot.json");
  await page
    .getByRole("button", { name: "Démonstration", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Vue immersive", exact: true })
    .click();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  console.log(
    "a11y",
    JSON.stringify(
      axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  );
  assert.equal(axe.violations.length, 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".working svg")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(artifactDir, "mobile.png"),
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Vue synthétique", exact: true })
    .click();
  await page.locator(".mission-row").first().click();
  await page.waitForFunction(
    () => document.activeElement === document.querySelector("aside"),
    null,
    { timeout: 2000 },
  );
  const mobileAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  console.log(
    "mobile a11y",
    JSON.stringify(
      mobileAxe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  );
  assert.equal(mobileAxe.violations.length, 0);
  await page.reload();
  await page.route("**/snapshot.json", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "demo", events: [] }),
    }),
  );
  await page
    .getByRole("button", { name: "Traces réelles", exact: true })
    .click();
  await page.getByText("RÉPONSE INVALIDE", { exact: true }).waitFor();
  assert.equal(await page.locator(".worker").count(), 0);
  await page.unroute("**/snapshot.json");
  await page.route("**/snapshot.json", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        mode: "real",
        transport: "snapshot",
        coverage: "partial",
        sourceRef: "synthetic-empty-test",
        generatedAt: "2026-10-23T10:00:00Z",
        projects: [],
        events: [],
        rejectedCount: 0,
      }),
    }),
  );
  await page.getByRole("button", { name: "Relire", exact: true }).click();
  await page.getByText("INSTANTANÉ RÉEL", { exact: true }).waitFor();
  await page
    .getByText("Le jardin est calme. Aucune activité connue à afficher.")
    .waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    "Browser checks passed: demo/retry/history, real snapshot, filters, offline cache, reduced motion, mobile, focus, no writes.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
