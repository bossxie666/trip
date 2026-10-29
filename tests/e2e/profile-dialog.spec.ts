import { expect, test, type Locator } from "@playwright/test";
import { enterTestSession } from "./session";

test("profile loads on demand and guards password drafts and member reset with site dialogs", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await enterTestSession(page);
  let nativeDialogs = 0, resetAttempts = 0, passwordAttempts = 0, sessionDeletes = 0, resetDone = false;
  const profileScripts: string[] = [];
  page.on("dialog", async dialog => { nativeDialogs++; await dialog.dismiss(); });
  page.on("request", request => {
    if (request.resourceType() === "script" && request.url().includes("MemberProfileDialog-")) profileScripts.push(request.url());
    if (request.method() === "DELETE" && new URL(request.url()).pathname === "/api/session") sessionDeletes++;
  });
  // Only the UI contract is simulated: this test never changes a real credential.
  await page.route("**/api/member/password", route => {
    passwordAttempts++;
    return route.fulfill({ status: 503, json: { message: "测试密码保存失败" } });
  });
  await page.route("**/api/admin/members", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { members: [
      { id: "member-nini", displayName: "nini", active: true, role: "admin", credentialStatus: "active", lastLoginAt: null },
      { id: "member-e2e-presence", displayName: "成员测试", active: true, role: "member", credentialStatus: resetDone ? "legacy" : "active", lastLoginAt: null },
    ] } });
    expect(route.request().postDataJSON()).toEqual({ memberId: "member-e2e-presence", action: "reset-password" });
    if (++resetAttempts === 1) return route.fulfill({ status: 503, json: { message: "测试重置暂时失败" } });
    resetDone = true; return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/trips");
  const trigger = page.locator(".site-header .member-identity-trigger");
  await expect(trigger).toBeVisible(); expect(profileScripts).toHaveLength(0);
  await trigger.click();
  const profile = page.getByRole("dialog", { name: "个人资料", exact: true });
  await expect(profile).toBeVisible(); expect(profileScripts.length).toBeGreaterThan(0);
  async function geometry(dialog: Locator) {
    for (const width of [320, 375, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const result = await dialog.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), y: Math.abs(rect.y + rect.height / 2 - innerHeight / 2),
          overflow: [element, ...element.querySelectorAll("*")].some(node => node.scrollWidth > node.clientWidth + 1),
          background: getComputedStyle(element).backgroundColor,
          images: [element, ...element.querySelectorAll("*")].some(node => getComputedStyle(node).backgroundImage !== "none") };
      });
      expect(result.x).toBeLessThanOrEqual(1); expect(result.y).toBeLessThanOrEqual(1);
      expect(result.overflow).toBe(false); expect(result.images).toBe(false); expect(result.background).toBe("rgb(255, 250, 240)");
    }
    await page.setViewportSize({ width: testInfo.project.name === "mobile" ? 390 : 1280, height: 844 });
  }
  await geometry(profile);
  await profile.getByRole("button", { name: "修改密码", exact: true }).click();
  await profile.getByLabel("当前密码", { exact: true }).fill("synthetic-current");
  await profile.getByLabel("新密码", { exact: true }).fill("synthetic-new-password");
  await profile.getByLabel("确认新密码", { exact: true }).fill("synthetic-mismatch");
  await geometry(profile);
  await profile.getByRole("button", { name: "保存新密码", exact: true }).click();
  await expect(profile.getByRole("alert")).toHaveText("两次输入的新密码不一致。"); expect(passwordAttempts).toBe(0);
  await profile.getByLabel("确认新密码", { exact: true }).fill("synthetic-new-password");
  await profile.getByRole("button", { name: "保存新密码", exact: true }).click();
  await expect(profile.getByRole("alert")).toHaveText("测试密码保存失败");
  await profile.getByRole("button", { name: "关闭", exact: true }).click();
  const discard = page.getByRole("dialog", { name: "放弃未保存修改", exact: true });
  await geometry(discard);
  await page.keyboard.press("Escape");
  await expect(discard).toHaveCount(0); await expect(profile).toBeVisible();
  await expect(profile.getByLabel("新密码", { exact: true })).toHaveValue("synthetic-new-password");
  await profile.getByRole("button", { name: "切换身份", exact: true }).click();
  await discard.getByRole("button", { name: "取消", exact: true }).click(); expect(sessionDeletes).toBe(0);
  await profile.getByRole("button", { name: "关闭", exact: true }).click();
  await discard.getByRole("button", { name: "放弃修改", exact: true }).click();
  await expect(profile).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await profile.getByRole("button", { name: "修改密码", exact: true }).click();
  await expect(profile.getByLabel("新密码", { exact: true })).toHaveValue("");
  await profile.getByRole("button", { name: "修改密码", exact: true }).click();
  await profile.getByRole("button", { name: "管理成员", exact: true }).click();
  const resetButton = profile.getByRole("button", { name: "重置密码", exact: true }).filter({ visible: true }).last();
  await resetButton.click();
  const reset = page.getByRole("dialog", { name: "重置成员密码", exact: true });
  await geometry(reset); await expect(reset).toContainText("成员测试");
  await reset.screenshot({ path: testInfo.outputPath("member-reset-confirmation.png"), scale: "css" });
  await page.keyboard.press("Escape"); await expect(reset).toHaveCount(0); await expect(resetButton).toBeFocused();
  expect(resetAttempts).toBe(0);
  await resetButton.click();
  await reset.getByRole("button", { name: "确认重置", exact: true }).click();
  await expect(reset.getByRole("alert")).toHaveText("测试重置暂时失败");
  await reset.getByRole("button", { name: "确认重置", exact: true }).click();
  await expect(reset).toHaveCount(0); await expect(profile.getByRole("status")).toContainText("已重置 成员测试");
  expect(resetAttempts).toBe(2); expect(nativeDialogs).toBe(0);
  await profile.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(profile).toHaveCount(0); await expect(trigger).toBeFocused();
});
