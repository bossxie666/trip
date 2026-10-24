import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function enterLegacySession(page: Page) {
  await page.goto("/unlock");
  const status = await page.evaluate(async () => (await fetch("/api/session", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memberName: "nini", code: "test-invite" }),
  })).status);
  expect(status).toBe(200);
}

test.beforeEach(async ({ page }) => enterLegacySession(page));

test("opens the bookshelf and a trip workspace without an intermediate page", async ({ page }) => {
  await page.goto("/trips");
  await expect(page.getByRole("navigation", { name: "行程状态" })).toBeVisible();
  const book = page.locator(".trip-book-cover").filter({ hasText: "上海测试旅行" });
  await expect(book).toBeVisible();
  await book.locator(".trip-book-meta").click();
  await expect(page).toHaveURL(/\/trips\/e2e-shanghai\/plan/);
  await expect(page.getByRole("navigation", { name: "工作台视图" })).toBeVisible();
  await expect(page.getByText("正在读取行程")).toHaveCount(0);
});

test("keeps the reserved mobile menu and bottom navigation available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile layout assertion");
  await page.goto("/");
  await expect(page.locator(".site-mobile-tools")).toBeVisible();
  await expect(page.locator(".site-mobile-nav")).toBeVisible();
  await expect(page.getByAltText("跳进地理书的旅行")).toBeVisible();
});

test("bounds thumbnail retries and lets the member recover without saving a photo", async ({ page }) => {
  let reads = 0, writes = 0;
  await page.route("**/api/albums", (route) => route.fulfill({ json: { albums: [{ id: "qa-retry-album", title: "仅测试图片恢复" }] } }));
  await page.route("**/api/albums/qa-retry-album", (route) => route.fulfill({ json: { album: { photos: [{ assetId: "qa-preview-photo", filename: "照片加载测试.png" }] } } }));
  await page.route("**/api/media/qa-preview-photo?*", (route) => {
    reads++;
    return reads <= 2 ? route.fulfill({ status: 503, json: { error: "temporary fixture failure" } }) : route.fulfill({
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64"),
    });
  });
  await page.route("**/api/home/featured-photos", (route) => { writes++; return route.abort(); });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "从相册选择地图照片" }).first();
  await trigger.click();
  const retry = page.getByRole("button", { name: "重新加载 照片加载测试.png" });
  await expect(retry).toBeVisible();
  expect(reads).toBe(2);
  await expect(retry).toHaveAttribute("aria-pressed", "false");
  await retry.click();
  const photo = page.getByRole("button", { name: "照片加载测试.png", exact: true });
  await expect.poll(() => photo.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  expect(reads).toBe(3);
  await expect(photo).toHaveAttribute("aria-pressed", "false");
  await photo.click();
  await expect(photo).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "选择地图照片" })).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes).toBe(0);
});

test("has no critical accessibility violations on primary pages", async ({ page }) => {
  for (const path of ["/", "/trips", "/trips/e2e-shanghai/plan?view=planning"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.filter((violation) => violation.impact === "critical"), path).toEqual([]);
  }
});
