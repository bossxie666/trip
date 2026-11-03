import { expect, test } from "@playwright/test";
import { enterTestSession } from "./session";

test("accommodation editor waits until requested and can close during a slow download", async ({ page }) => {
  await enterTestSession(page);
  let requests = 0;
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/BookingCreateEditor-*.js", async route => {
    requests += 1;
    await held;
    await route.continue();
  });
  try {
    await page.goto("/trips/shanghai-hangzhou-2026/plan?view=planning");
    const trigger = page.getByRole("button", { name: "＋ 添加住宿", exact: true });
    await expect(trigger).toBeEnabled();
    expect(requests).toBe(0);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "添加住宿", exact: true });
    await expect(dialog.getByRole("status")).toHaveText("正在加载…");
    await expect.poll(() => requests).toBe(1);
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    release();
    await trigger.click();
    await expect(dialog.getByLabel("入住日期", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  } finally { release(); }
});
