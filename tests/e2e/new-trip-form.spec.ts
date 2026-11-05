import { test, expect } from "@playwright/test";
import { enterTestSession } from "./session";

test("new trip preserves fields after failure and blocks concurrent submission", async ({ page }) => {
  await enterTestSession(page);
  let attempts = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/trips", async route => {
    if (route.request().method() !== "POST") return route.continue();
    if (++attempts === 1) return route.fulfill({ status: 503, json: { message: "合成保存失败，稍后重试" } });
    await pending;
    return route.fulfill({ status: 200, json: { trip: { slug: "e2e-shanghai" } } });
  });
  try {
    await page.goto("/trips/new");
    const title = page.getByRole("textbox", { name: "行程名称 *", exact: true });
    await title.fill("合成表单测试");
    await page.getByLabel("日期未定", { exact: true }).check();
    await page.getByRole("button", { name: "创建行程", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("合成保存失败，稍后重试");
    await expect(title).toHaveValue("合成表单测试");
    await expect(page.getByLabel("日期未定", { exact: true })).toBeChecked();
    await page.locator("form.new-trip-form").evaluate(form => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => attempts).toBe(2);
    await expect(title).toBeDisabled();
    await expect(page.getByRole("button", { name: "正在保存…", exact: true })).toBeDisabled();
    release();
    await expect(page).toHaveURL(/\/trips\/e2e-shanghai\/plan/);
    expect(attempts).toBe(2);
  } finally { release(); }
});

test("new trip network failure keeps the draft and warns against blind resubmission", async ({ page }) => {
  await enterTestSession(page);
  await page.route("**/api/trips", route => route.request().method() === "POST" ? route.abort("failed") : route.continue());
  await page.goto("/trips/new");
  await page.getByRole("textbox", { name: "行程名称 *", exact: true }).fill("合成网络失败");
  await page.getByLabel("日期未定", { exact: true }).check();
  await page.getByRole("button", { name: "创建行程", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("保存结果尚未确认");
  await expect(page.getByRole("textbox", { name: "行程名称 *", exact: true })).toHaveValue("合成网络失败");
  await expect(page.getByRole("button", { name: "创建行程", exact: true })).toBeEnabled();
});
