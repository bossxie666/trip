import { test, expect } from "@playwright/test";
import { enterTestSession } from "./session";

test.beforeEach(async ({ page }) => enterTestSession(page));

test("restores the open chapter while keeping entries keyboard accessible without repeated navigation", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/");
  const wrap = page.locator("#scene-wrap");
  await page.locator("#scene-open").click();
  await expect(wrap).toHaveAttribute("data-state", "open");
  await page.locator("#scene-next").click();
  await expect(wrap).toHaveAttribute("data-page", "2");
  await expect(wrap).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#chapter-links,.desk-access,#scene-close")).toHaveCount(0);
  const entry = page.locator("#scene-links").getByRole("link", { name: "上海测试旅行", exact: true });
  await entry.focus();
  await expect(entry).toBeVisible();
  await entry.press("Enter");
  await expect(page).toHaveURL(/\/trips\/e2e-shanghai\/plan$/);
  await page.getByRole("link", { name: "首页", exact: true }).first().click();
  await expect(wrap).toHaveAttribute("data-state", "open");
  await expect(wrap).toHaveAttribute("data-page", "2");
  await page.locator("#scene-next").click();
  await expect(wrap).toHaveAttribute("data-page", "3");
  await expect(wrap).toHaveAttribute("aria-busy", "false");
  await page.reload();
  await expect(wrap).toHaveAttribute("data-page", "3");
  await expect(wrap).toHaveAttribute("aria-busy", "false");
  await wrap.focus();
  await page.keyboard.press("Enter");
  await expect(wrap).toHaveAttribute("data-state", "closed");
  await page.reload();
  await expect(page.locator("#scene-open")).toBeVisible();
});

test("last-page blank paper closes the 3D book and all pages share the home background", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const wrap = page.locator("#scene-wrap");
  await page.locator("#scene-open").click();
  await expect(wrap).toHaveAttribute("data-state", "open");
  await page.locator("#scene-next").click();
  await expect(wrap).toHaveAttribute("data-page", "2");
  await expect(wrap).toHaveAttribute("aria-busy", "false");
  await page.locator("#scene-next").click();
  await expect(wrap).toHaveAttribute("data-page", "3");
  await expect(wrap).toHaveAttribute("aria-busy", "false");
  await page.screenshot({ path: `work/home-last-page-${test.info().project.name}.png`, fullPage: true });
  const canvas = page.locator("#scene-canvas"), box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * .33, y: box.height * .5 } });
  await expect(wrap).toHaveAttribute("data-state", "closed");
  await expect(page.locator("#scene-links a")).toHaveCount(0);
  for (const route of ["/", "/trips", "/trips/e2e-shanghai/plan", "/albums", "/messages", "/knowledge", "/persona"]) {
    await page.goto(route);
    const style = await page.locator("body").evaluate(element => ({ image: getComputedStyle(element).backgroundImage, texture: getComputedStyle(element, "::before").display }));
    expect(style.image).toContain("radial-gradient");
    expect(style.image).not.toContain("url(");
    expect(style.texture).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  expect(errors).toEqual([]);
});

test("starts home audio after the first interaction if autoplay is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      HTMLMediaElement.prototype.play = play;
      return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
    };
  });
  await page.goto("/");
  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /track-01-web\.mp3$/);
  await expect(audio).toHaveJSProperty("paused", true);
  await page.getByRole("button", { name: "曲目", exact: true }).click();
  await expect(audio).toHaveJSProperty("paused", false);
  await page.locator("#disc").press("Enter");
  await expect(audio).toHaveJSProperty("paused", true);
  await page.reload();
  await expect(page.locator("#disc")).toHaveAttribute("aria-label", "播放音乐");
  await expect(audio).not.toHaveAttribute("src", /.+/);
});


test("a delayed engine times out visibly and a late download does not open the book by itself", async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/scene.js?*", async route => { await held; await route.continue().catch(() => {}); });
  await page.clock.install();
  try {
    await page.goto("/");
    await page.locator("#scene-open").click();
    await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state", "loading");
    await page.clock.fastForward(15100);
    await expect(page.getByRole("button", { name: "重试打开旅行书", exact: true })).toBeEnabled();
    await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state", "closed");
    const downloaded = page.waitForResponse(response => response.url().includes("/scene.js?"));
    release();
    await downloaded;
    await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state", "closed");
    await page.getByRole("button", { name: "重试打开旅行书", exact: true }).click();
    await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state", "opening");
    await page.clock.runFor(1100);
    await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state", "open");
  } finally { release(); }
});
