import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("guestbook dialogs preserve drafts, recover from failures and confirm deletion", async ({ page }) => {
  await enterTestSession(page);
  const original = `留言弹窗-${randomUUID()}`;
  let messageId: string | undefined, creates = 0, updates = 0, deletes = 0;
  await page.route("**/api/guestbook", route => {
    if (route.request().method() === "POST" && ++creates === 1) return route.fulfill({ status: 503, json: { error: "测试留言保存失败" } });
    return route.continue();
  });
  await page.route("**/api/guestbook/*", route => {
    const method = route.request().method();
    if (method === "PATCH" && ++updates === 1) return route.fulfill({ status: 503, json: { error: "测试留言修改失败" } });
    if (method === "DELETE" && ++deletes === 1) return route.fulfill({ status: 503, json: { error: "测试留言删除失败" } });
    return route.continue();
  });
  try {
    await page.goto("/messages");
    const trigger = page.getByRole("button", { name: "写下留言", exact: true });
    await trigger.click();
    const composer = page.getByRole("dialog", { name: "写下留言", exact: true });
    await composer.getByRole("textbox", { name: "留言内容", exact: true }).fill(original);
    for (const width of [320, 375, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await composer.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { centerX: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), centerY: Math.abs(rect.y + rect.height / 2 - innerHeight / 2),
          background: getComputedStyle(element).backgroundColor,
          images: [element, ...element.querySelectorAll("*")].filter(item => getComputedStyle(item).backgroundImage !== "none").length };
      });
      expect(layout.centerX).toBeLessThanOrEqual(1);
      expect(layout.centerY).toBeLessThanOrEqual(1);
      expect(layout.background).toBe("rgb(255, 250, 240)");
      expect(layout.images).toBe(0);
    }
    await composer.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "继续编辑", exact: true }).click();
    await expect(composer.getByRole("textbox", { name: "留言内容", exact: true })).toHaveValue(original);
    await composer.getByRole("button", { name: "保存", exact: true }).click();
    await expect(composer.getByRole("alert")).toHaveText("测试留言保存失败");
    const created = page.waitForResponse(response => new URL(response.url()).pathname === "/api/guestbook" && response.request().method() === "POST");
    await composer.getByRole("button", { name: "保存", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    messageId = (await response.json()).message.id;
    await expect(composer).toHaveCount(0);
    await expect(trigger).toBeFocused();
    const card = page.locator("article.guestbook-note").filter({ hasText: original });
    await card.getByRole("button", { name: "编辑", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "编辑留言", exact: true });
    await editor.getByRole("textbox", { name: "留言内容", exact: true }).fill(`${original}-修改`);
    await editor.getByRole("button", { name: "删除留言", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "删除留言", exact: true });
    expect(deletes).toBe(0);
    await confirmation.getByRole("button", { name: "取消", exact: true }).click();
    await expect(editor.getByRole("textbox", { name: "留言内容", exact: true })).toHaveValue(`${original}-修改`);
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试留言修改失败");
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(card).toContainText(`${original}-修改`);
    await card.getByRole("button", { name: "编辑", exact: true }).click();
    await editor.getByRole("textbox", { name: "留言内容", exact: true }).fill("应被放弃的修改");
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "放弃修改", exact: true }).click();
    await expect(card).toContainText(`${original}-修改`);
    await card.getByRole("button", { name: "删除", exact: true }).click();
    await confirmation.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(confirmation.getByRole("alert")).toHaveText("测试留言删除失败");
    await expect(card).toBeVisible();
    await confirmation.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(card).toHaveCount(0);
  } finally {
    if (messageId) await fixtureRequest(page, "DELETE", `/api/guestbook/${messageId}`);
  }
});

test("guestbook retries reuse completed image uploads and retain the selected files", async ({ page }) => {
  await enterTestSession(page);
  const title = `图片重试-${randomUUID()}`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=", "base64");
  const attempts: Record<string, number> = {};
  let puts = 0, completes = 0, creates = 0;
  await page.route("**/api/media/uploads", async route => {
    const { filename, purpose } = route.request().postDataJSON();
    expect(purpose).toBe("guestbook");
    attempts[filename] = (attempts[filename] || 0) + 1;
    if (filename === "second.png" && attempts[filename] === 1) return route.fulfill({ status: 503, json: { error: "测试第二张上传失败" } });
    return route.fulfill({ json: { assetId: filename, uploadUrl: `http://127.0.0.1:8787/api/test-guestbook-upload/${filename}`, method: "PUT" } });
  });
  await page.route("**/api/test-guestbook-upload/*", route => { puts += 1; return route.fulfill({ status: 200, body: "" }); });
  await page.route("**/api/media/uploads/*/complete", route => { completes += 1; return route.fulfill({ json: { asset: { id: "test-image" } } }); });
  await page.route("**/api/guestbook", route => {
    if (route.request().method() !== "POST") return route.continue();
    creates += 1;
    expect(route.request().postDataJSON().mediaAssetIds).toEqual(["first.png", "second.png"]);
    if (creates === 1) return route.fulfill({ status: 503, json: { error: "测试关联失败" } });
    return route.fulfill({ status: 201, json: { message: { id: "test-message-only-in-browser", body: title, createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z", author: { id: "member-nini", displayName: "nini", avatar: null }, media: [] } } });
  });
  await page.goto("/messages");
  await page.getByRole("button", { name: "写下留言", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "写下留言", exact: true });
  await dialog.getByRole("textbox", { name: "留言内容", exact: true }).fill(title);
  const files = ["first.png", "second.png"].map(name => ({ name, mimeType: "image/png", buffer: png }));
  await dialog.locator("input[type=file]").setInputFiles([...files, ...files]);
  await expect(dialog.getByRole("alert")).toHaveText("一次最多添加 3 张图片。");
  await dialog.locator("input[type=file]").setInputFiles(files);
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("测试第二张上传失败");
  expect(attempts).toEqual({ "first.png": 1, "second.png": 1 });
  await expect(dialog.locator(".guestbook-attachments li")).toHaveCount(2);
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("测试关联失败");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(attempts).toEqual({ "first.png": 1, "second.png": 2 });
  expect(puts).toBe(2);
  expect(completes).toBe(2);
  expect(creates).toBe(2);
  await expect(page.locator("article.guestbook-note").filter({ hasText: title })).toBeVisible();
});
