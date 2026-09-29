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

test("has no critical accessibility violations on primary pages", async ({ page }) => {
  for (const path of ["/", "/trips", "/trips/e2e-shanghai/plan?view=planning"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.filter((violation) => violation.impact === "critical"), path).toEqual([]);
  }
});
