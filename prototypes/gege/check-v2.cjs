// Isolated browser tests: the Publisher transport is intercepted; no production action runs.
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const { readFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const artifacts = process.env.GEGE_ARTIFACTS || "/tmp/gege-v2-artifacts";
mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [],
      writes = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => {
      if (r.method() !== "GET") writes.push(r.method());
    });
    const recorded = JSON.parse(
      readFileSync(join(__dirname, "public/snapshot.json")),
    );
    await page.route("**/api/garden/v1/snapshot", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(recorded),
      }),
    );
    await page.goto(process.env.GEGE_PREVIEW_URL || "http://localhost:4175");
    await page.getByText("LECTURE CONNECTÉE", { exact: true }).waitFor();
    const rowsBefore = await page.locator(".event").count();
    const groupCounts = await page
      .locator(".crew-legend button > span")
      .allTextContents();
    const total = groupCounts.reduce(
      (sum, s) => sum + Number(s.split(" ")[0]),
      0,
    );
    assert.ok(total > 7);
    await page
      .getByRole("button", { name: "Vue synthétique", exact: true })
      .click();
    assert.equal(await page.locator(".mission-row").count(), total);
    await page
      .getByRole("button", { name: "Vue immersive", exact: true })
      .click();
    assert.equal(await page.locator(".crew-legend button").count(), 7);
    const largest = groupCounts.indexOf(
      [...groupCounts].sort((a, b) => parseInt(b) - parseInt(a))[0],
    );
    await page.locator(".crew-legend button").nth(largest).click();
    assert.equal(
      await page.locator(".crew-mission").count(),
      parseInt(groupCounts[largest]),
    );
    await page.locator(".crew-mission").first().click();
    assert.equal(
      await page.locator('aside [data-character="hamster"]').count(),
      1,
    );
    await page
      .getByRole("button", {
        name: "Gérard, poulpe coordinateur : ouvrir le noyau",
      })
      .click();
    assert.equal(
      await page.locator('aside [data-character="octopus"]').count(),
      1,
    );
    assert.equal(await page.locator(".chief [data-tentacle]").count(), 8);
    assert.equal(await page.locator(".event").count(), rowsBefore);
    await page
      .getByRole("button", { name: "Démonstration", exact: true })
      .click();
    assert.equal(
      await page.locator('.worker [data-character="hamster"]').count(),
      7,
    );
    await page
      .getByRole("button", { name: "Greffeur : 1 mission, afficher les états" })
      .click();
    assert.match(await page.locator(".crew-missions").innerText(), /Échouée/);
    const vp = page.locator(".viewport"),
      world = page.locator(".world");
    const zoom = async () => Number(await vp.getAttribute("data-zoom"));
    for (const width of [1440, 390, 320, 844]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 1000 });
      await page
        .getByRole("button", { name: "Tout le jardin", exact: true })
        .click();
      await page.waitForTimeout(80);
      const v = await vp.boundingBox(),
        w = await world.boundingBox();
      assert.ok(
        w.x >= v.x - 1 && w.x + w.width <= v.x + v.width + 1,
        `Whole scene fits at ${width}`,
      );
      assert.ok(w.y >= v.y - 1 && w.y + w.height <= v.y + v.height + 1);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      for (const box of await page
        .locator(".camera button, .worker, .parcels button")
        .evaluateAll((es) =>
          es.map((e) => ({
            w: e.getBoundingClientRect().width,
            h: e.getBoundingClientRect().height,
          })),
        )) {
        assert.ok(
          box.w >= 43.9 && box.h >= 43.9,
          "Touch targets remain at least 44px",
        );
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Zoom avant", exact: true }).click();
    assert.ok((await zoom()) > 1);
    await vp.focus();
    await page.keyboard.press("+");
    await page.keyboard.press("ArrowLeft");
    const moved = await world.getAttribute("style");
    await page.keyboard.press("ArrowRight");
    assert.notEqual(await world.getAttribute("style"), moved);
    await page.keyboard.press("Home");
    assert.equal(await zoom(), 1);
    await page
      .getByRole("button", { name: "Atelier des Floraisons", exact: true })
      .click();
    assert.equal(await zoom(), 2.4);
    await page
      .getByRole("button", { name: "Tout le jardin", exact: true })
      .click();
    await vp.scrollIntoViewIfNeeded();
    assert.notEqual(
      await vp.evaluate((e) => getComputedStyle(e).touchAction),
      "none",
    );
    await page
      .getByRole("button", { name: "Explorer au toucher", exact: true })
      .click();
    await vp.scrollIntoViewIfNeeded();
    const cdp = await context.newCDPSession(page);
    let rect = await vp.boundingBox();
    const cx = rect.x + rect.width / 2,
      cy = rect.y + rect.height / 2;
    const touch = (type, points) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map(([x, y], id) => ({ x, y, id })),
      });
    await touch("touchStart", [
      [cx - 30, cy],
      [cx + 30, cy],
    ]);
    for (let distance = 40; distance <= 75; distance += 5)
      await touch("touchMove", [
        [cx - distance, cy],
        [cx + distance, cy],
      ]);
    await touch("touchEnd", []);
    assert.ok((await zoom()) > 1.8, "Two-finger pinch zooms");
    const beforeDrag = await world.getAttribute("style");
    await touch("touchStart", [[cx, cy + 80]]);
    await touch("touchMove", [[cx + 45, cy + 80]]);
    await touch("touchEnd", []);
    assert.notEqual(
      await world.getAttribute("style"),
      beforeDrag,
      "One finger pans",
    );
    await touch("touchStart", [[cx, cy + 80]]);
    await touch("touchCancel", []);
    await page
      .getByRole("button", { name: "Explorer au toucher", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tout le jardin", exact: true })
      .click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".working svg")
        .first()
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    for (const [name, width, height] of [
      ["mobile", 390, 844],
      ["desktop", 1440, 1000],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(80);
      const violations = (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations;
      assert.deepEqual(
        violations.map((v) => v.id),
        [],
      );
      await page.screenshot({
        path: join(artifacts, `v2-${name}.png`),
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(
      "V2 passed: identity, 8 tentacles, 7 roles, complete groups, unchanged journal, 320/390/844/1440 framing, keyboard, pinch, drag, cancellation, 44px targets, reduced motion, axe, GET only.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
