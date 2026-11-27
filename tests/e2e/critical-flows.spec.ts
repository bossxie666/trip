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

test("loads the planning map when its canvas scrolls into view", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile";
  await page.setViewportSize({ width: mobile ? 390 : 1280, height: 570 });
  let mapRequested = false;
  page.on("request", request => {
    if (/\/PlanMap-[^/]+\.js$/.test(new URL(request.url()).pathname)) mapRequested = true;
  });
  await page.goto("/trips/e2e-shanghai/plan?view=planning");
  await expect(page.getByRole("button", { name: "＋ 添加住宿", exact: true })).toBeEnabled();
  const placeholder = page.locator(".planning-map-placeholder");
  await expect(placeholder).not.toBeInViewport();
  expect(mapRequested).toBe(false);
  if (mobile) {
    await expect(placeholder).toBeHidden();
    await page.getByRole("link", { name: "打开完整地图 →" }).click();
    await expect(page).toHaveURL(/view=map/);
  } else {
    await placeholder.scrollIntoViewIfNeeded();
  }
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

test("shows a recently visited day within one second while the return request is held", async ({ page }) => {
  await page.goto("/trips/e2e-shanghai/plan?view=planning");
  const rail = page.getByRole("navigation", { name: "选择日期" });
  const first = rail.getByRole("link").nth(0);
  const second = rail.getByRole("link").nth(1);
  const heading = page.locator(".itinerary-panel h2");
  const firstTitle = await heading.innerText();
  await expect(page.getByRole("button", { name: "＋ 添加住宿", exact: true })).toBeEnabled();
  await second.click();
  await expect(heading).not.toHaveText(firstTitle);
  const returnUrl = new URL((await first.getAttribute("href"))!, page.url());
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => url.pathname.startsWith(returnUrl.pathname) && url.searchParams.get("day") === returnUrl.searchParams.get("day"), async route => {
    await held;
    await route.continue();
  });
  try {
    await first.evaluate(anchor => (anchor as HTMLAnchorElement).click());
    await expect(heading).toHaveText(firstTitle, { timeout: 950 });
  } finally {
    release();
  }
  await expect(page).toHaveURL(returnUrl.href);
});

test("planning uses a single flat surface without a book crease", async ({ page }) => {
  await page.goto("/trips/e2e-shanghai/plan?view=planning");
  const sheet = page.locator(".trip-book-leaf");
  const columns = page.locator(".plan-columns");
  for (const surface of [sheet, columns]) {
    await expect(surface).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(surface).toHaveCSS("background-image", "none");
    await expect(surface).toHaveCSS("box-shadow", "none");
  }
  expect(await sheet.evaluate(el => getComputedStyle(el, "::before").content)).toBe("none");
  expect(await columns.evaluate(el => getComputedStyle(el, "::after").content)).toBe("none");
});
