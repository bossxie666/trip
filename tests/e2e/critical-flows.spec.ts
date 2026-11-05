import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { enterTestSession } from "./session";

test.beforeEach(async ({ page }) => enterTestSession(page));

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

test("keeps the bookshelf visible and shows progress while a trip opens", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/trips\/e2e-shanghai\/plan(?:\?|$)/, async route => {
    await held;
    await route.continue();
  });
  try {
    await page.goto("/trips");
    const book = page.locator(".trip-book-cover").filter({ hasText: "上海测试旅行" });
    await book.locator(".trip-book-meta").click();
    await expect(book.getByRole("status")).toHaveText("正在打开…");
    await expect(page.getByRole("navigation", { name: "行程状态" })).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByRole("navigation", { name: "工作台视图" })).toBeVisible();
});

test("loads the planning map when its canvas scrolls into view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 570 });
  let mapRequested = false;
  page.on("request", request => {
    if (/\/PlanMap-[^/]+\.js$/.test(new URL(request.url()).pathname)) mapRequested = true;
  });
  await page.goto("/trips/e2e-shanghai/plan?view=planning");
  await expect(page.getByRole("button", { name: "＋ 添加住宿", exact: true })).toBeEnabled();
  const placeholder = page.locator(".planning-map-placeholder");
  await expect(placeholder).not.toBeInViewport();
  expect(mapRequested).toBe(false);
  await placeholder.scrollIntoViewIfNeeded();
  await expect(page.getByLabel("高德地图", { exact: true })).toBeAttached();
  expect(mapRequested).toBe(true);
});

test("keeps the reserved mobile menu and bottom navigation available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile layout assertion");
  await page.goto("/");
  await expect(page.locator(".site-mobile-tools")).toBeVisible();
  await expect(page.locator(".site-mobile-nav")).toBeVisible();
  await expect(page.locator('canvas[aria-label*="跳进地理书的旅行"]')).toBeVisible();
});

test("has no critical accessibility violations on primary pages", async ({ page }) => {
  for (const path of ["/", "/trips", "/trips/e2e-shanghai/plan?view=planning"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.filter((violation) => violation.impact === "critical"), path).toEqual([]);
  }
});
