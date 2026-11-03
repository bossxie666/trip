import { test, expect } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("members select an audience, like and reply in centered plain dialogs", async ({ page }) => {
  test.setTimeout(60_000);
  await enterTestSession(page);
  const text = `成员留言-${Date.now()}`;
  let id: string | undefined, likes = 0, replies = 0;
  await page.route("**/api/guestbook/*/like", route => {
    if (++likes === 1) return route.fulfill({ status: 503, json: { message: "点赞暂时失败" } });
    return route.continue();
  });
  await page.route("**/api/guestbook/*/replies", route => {
    if (++replies === 1) return route.fulfill({ status: 503, json: { message: "回复暂时失败" } });
    return route.continue();
  });
  try {
    await page.goto("/messages");
    await page.getByRole("button", { name: "写下留言", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "写下留言", exact: true });
    await editor.getByRole("textbox", { name: "留言内容", exact: true }).fill(text);
    await editor.getByLabel("可见范围").selectOption("selected");
    await expect(editor.getByRole("checkbox", { name: "nini（自己）" })).toBeChecked();
    await expect(editor.getByRole("checkbox", { name: "nini（自己）" })).toBeDisabled();
    await editor.getByRole("checkbox", { name: "kiki", exact: true }).check();
    const saved = page.waitForResponse(r => new URL(r.url()).pathname === "/api/guestbook" && r.request().method() === "POST");
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    const result = await saved; expect(result.status()).toBe(201); id = (await result.json()).message.id;
    const card = page.locator("article.guestbook-note").filter({ hasText: text });
    await expect(card).toContainText("指定成员可见");
    await card.getByRole("button", { name: "点赞", exact: true }).click();
    await expect(card.getByRole("alert")).toHaveText("点赞暂时失败");
    await card.getByRole("button", { name: "点赞", exact: true }).click();
    await expect(card.getByRole("button", { name: "取消点赞", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(card).toContainText("nini 赞了");
    await card.getByRole("button", { name: "回复", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "回复留言", exact: true });
    await dialog.getByRole("textbox", { name: "回复内容", exact: true }).fill("一起出发！");
    await dialog.getByRole("button", { name: "发送", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("回复暂时失败");
    await expect(dialog.getByRole("textbox", { name: "回复内容", exact: true })).toHaveValue("一起出发！");
    await dialog.getByRole("button", { name: "发送", exact: true }).click();
    await expect(dialog.locator(".guestbook-thread")).toContainText("一起出发！");
    await expect(dialog.getByRole("textbox", { name: "回复内容", exact: true })).toHaveValue("");
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await dialog.evaluate(el => {
        const box = el.getBoundingClientRect();
        return { x: Math.abs(box.x + box.width / 2 - innerWidth / 2), y: Math.abs(box.y + box.height / 2 - innerHeight / 2), background: getComputedStyle(el).backgroundColor, images: [...el.querySelectorAll("*")].filter(item => getComputedStyle(item).backgroundImage !== "none").length };
      });
      expect(layout.x).toBeLessThanOrEqual(1); expect(layout.y).toBeLessThanOrEqual(1);
      expect(layout.background).toBe("rgb(255, 250, 240)"); expect(layout.images).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      if (width === 390) await page.screenshot({ path: `work/guestbook-social-${test.info().project.name}.png` });
    }
    await dialog.getByRole("button", { name: "删除nini的回复" }).click();
    const remove = page.getByRole("dialog", { name: "删除回复", exact: true });
    await remove.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(dialog.locator(".guestbook-thread")).toHaveText("暂无回复");
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await card.getByRole("button", { name: "编辑", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "编辑留言", exact: true });
    await expect(edit.getByRole("checkbox", { name: "kiki", exact: true })).toBeChecked();
    await edit.getByRole("checkbox", { name: "kiki", exact: true }).uncheck();
    await edit.getByRole("button", { name: "保存", exact: true }).click();
    await expect(edit).toHaveCount(0);
    await page.reload();
    await expect(card.getByRole("button", { name: "取消点赞", exact: true })).toBeVisible();
    await card.getByRole("button", { name: "取消点赞", exact: true }).click();
    await expect(card.getByRole("button", { name: "点赞", exact: true })).toBeVisible();
  } finally { if (id) await fixtureRequest(page, "DELETE", `/api/guestbook/${id}`); }
});
