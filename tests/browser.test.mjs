import assert from "node:assert/strict";

import { chromium } from "playwright";

const baseURL = process.env.SITE_URL || "http://127.0.0.1:4175";
const browser = await chromium.launch({ headless: true });

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert.ok(overflow <= 1, `${label}: horizontal overflow is ${overflow}px`);
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const desktopErrors = [];
  desktop.on("console", (message) => {
    if (message.type() === "error") desktopErrors.push(message.text());
  });
  desktop.on("pageerror", (error) => desktopErrors.push(error.message));
  await desktop.goto(baseURL, { waitUntil: "networkidle" });

  assert.equal(await desktop.locator("#topology-canvas").count(), 1, "topology canvas missing");
  assert.equal(await desktop.locator("#scroll-progress").count(), 1, "scroll progress missing");
  assert.equal(await desktop.locator("html").getAttribute("data-motion-mode"), "full");

  const canvasSize = await desktop.locator("#topology-canvas").evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    state: canvas.dataset.animationState,
  }));
  assert.ok(canvasSize.width >= 1440, `canvas width too small: ${canvasSize.width}`);
  assert.ok(canvasSize.height >= 1000, `canvas height too small: ${canvasSize.height}`);
  assert.equal(canvasSize.state, "running");

  await desktop.locator("#research").evaluate((element) =>
    element.scrollIntoView({ behavior: "instant", block: "start" }),
  );
  await desktop.waitForFunction(() => window.scrollY > 0);
  await desktop.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  assert.equal(
    await desktop.locator('.site-header nav a[aria-current="location"]').getAttribute("href"),
    "#research",
  );
  const progress = Number(
    await desktop.locator("#scroll-progress").evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--scroll-progress"),
    ),
  );
  assert.ok(progress > 0 && progress < 1, `unexpected scroll progress: ${progress}`);

  const depthCard = desktop.locator(".research-card").first();
  const box = await depthCard.boundingBox();
  assert.ok(box, "research card has no layout box");
  await desktop.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.15);
  await desktop.waitForTimeout(80);
  const tilt = await depthCard.evaluate((element) => ({
    x: getComputedStyle(element).getPropertyValue("--tilt-x").trim(),
    y: getComputedStyle(element).getPropertyValue("--tilt-y").trim(),
  }));
  assert.notEqual(tilt.x, "0deg", "card x tilt remained neutral");
  assert.notEqual(tilt.y, "0deg", "card y tilt remained neutral");

  await desktop.locator('.filter-button[data-filter="identity"]').click();
  assert.equal(await desktop.locator(".project-card:not([hidden])").count(), 3);
  assert.equal(await desktop.locator("#visible-count").textContent(), "3");
  assert.match(desktop.url(), /[?&]focus=identity(?:&|$)/);
  await assertNoHorizontalOverflow(desktop, "desktop");
  assert.deepEqual(desktopErrors, []);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(baseURL, { waitUntil: "networkidle" });
  assert.equal(await mobile.locator("html").getAttribute("data-motion-mode"), "ambient");
  await assertNoHorizontalOverflow(mobile, "mobile");
  await mobile.close();

  const reducedContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
  });
  const reduced = await reducedContext.newPage();
  await reduced.goto(baseURL, { waitUntil: "networkidle" });
  assert.equal(await reduced.locator("html").getAttribute("data-motion-mode"), "static");
  assert.equal(
    await reduced.locator("#topology-canvas").getAttribute("data-animation-state"),
    "static",
  );
  assert.equal(
    await reduced.locator(".reveal").first().evaluate((element) => getComputedStyle(element).opacity),
    "1",
  );
  await reducedContext.close();

  const noScriptContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  });
  const noScript = await noScriptContext.newPage();
  await noScript.goto(baseURL, { waitUntil: "domcontentloaded" });
  assert.equal(await noScript.locator(".project-card:not([hidden])").count(), 14);
  assert.equal(
    await noScript.locator(".reveal").first().evaluate((element) => getComputedStyle(element).opacity),
    "1",
  );
  await noScriptContext.close();

  console.log("browser experience passed: full, ambient, static, and no-script modes");
} finally {
  await browser.close();
}
