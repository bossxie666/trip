import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("photo actions preserve drafts, retry failures and confirm the selected deletion", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/albums", { title: `照片管理-${randomUUID()}`, tripId: "trip-e2e" });
  expect(created.status()).toBe(201);
  const { album } = await created.json(), root = `/api/albums/${album.id}`;
  const attempts = new Map<string, number>();
  let nativeDialogs = 0;
  page.on("dialog", async dialog => { nativeDialogs++; await dialog.dismiss(); });
  await page.route(`**${root}/media/batch`, route => {
    const action = route.request().method() === "DELETE" ? "delete" : route.request().postDataJSON().action;
    const count = (attempts.get(action) || 0) + 1; attempts.set(action, count);
    if (count === 1) return route.fulfill({ status: 503, json: { message: `测试 ${action} 暂时失败` } });
    return route.continue();
  });
  const bar = page.locator(".album-selection-bar");
  const selectFirst = async () => {
    await page.getByRole("navigation", { name: "照片筛选" }).getByRole("button", { name: "选择", exact: true }).click();
    await page.getByRole("button", { name: "选择first.png", exact: true }).click();
  };
  async function checkDialog(dialog: Locator) {
    for (const width of [320, 375, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const metrics = await dialog.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), y: Math.abs(rect.y + rect.height / 2 - innerHeight / 2),
          overflow: [element, ...element.querySelectorAll("*")].some(node => node.scrollWidth > node.clientWidth + 1),
          background: getComputedStyle(element).backgroundColor,
          images: [element, ...element.querySelectorAll("*")].some(node => getComputedStyle(node).backgroundImage !== "none") };
      });
      expect(metrics.x).toBeLessThanOrEqual(1); expect(metrics.y).toBeLessThanOrEqual(1);
      expect(metrics.overflow).toBe(false); expect(metrics.images).toBe(false); expect(metrics.background).toBe("rgb(255, 250, 240)");
    }
    await page.setViewportSize({ width: testInfo.project.name === "mobile" ? 390 : 1280, height: 844 });
  }
  try {
    await page.goto(`/albums/${album.id}`);
    const buffer = await readFile("tests/fixtures/photo.png");
    await page.locator("input.album-floating-input").setInputFiles([{ name: "first.png", mimeType: "image/png", buffer }, { name: "second.png", mimeType: "image/png", buffer }]);
    await expect(page.locator(".album-photo-tile")).toHaveCount(2);
    const original = (await (await fixtureRequest(page, "GET", root)).json()).album;
    const first = original.photos.find((photo: { filename: string }) => photo.filename === "first.png");
    const second = original.photos.find((photo: { filename: string }) => photo.filename === "second.png");
    expect((await fixtureRequest(page, "PATCH", root, { coverMediaAssetId: first.assetId })).status()).toBe(200);
    await selectFirst();
    await bar.getByRole("button", { name: "标签", exact: true }).click();
    const tags = page.getByRole("dialog", { name: "管理照片标签", exact: true });
    await checkDialog(tags);
    await tags.getByLabel("添加标签", { exact: true }).fill("一起旅行");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "继续编辑", exact: true }).click();
    await expect(tags.getByLabel("添加标签", { exact: true })).toHaveValue("一起旅行");
    await tags.getByRole("button", { name: "添加到选中照片", exact: true }).click();
    await expect(tags.getByRole("alert")).toHaveText("测试 addTag 暂时失败");
    await tags.getByRole("button", { name: "添加到选中照片", exact: true }).click();
    await expect(tags).toHaveCount(0);
    let saved = (await (await fixtureRequest(page, "GET", root)).json()).album;
    expect(saved.photos.find((photo: { assetId: string }) => photo.assetId === first.assetId).tagIds).toContain(saved.tags[0].id);
    expect(saved.photos.find((photo: { assetId: string }) => photo.assetId === second.assetId).tagIds).toEqual([]);
    await selectFirst(); await bar.getByRole("button", { name: "标签", exact: true }).click();
    await expect(tags.getByLabel("添加标签", { exact: true })).toHaveValue("");
    await tags.getByRole("button", { name: "一起旅行 ×", exact: true }).click();
    await expect(tags.getByRole("alert")).toHaveText("测试 removeTag 暂时失败");
    await tags.getByRole("button", { name: "一起旅行 ×", exact: true }).click();
    await expect(tags).toHaveCount(0);
    await selectFirst(); await bar.getByRole("button", { name: "日期", exact: true }).click();
    const date = page.getByRole("dialog", { name: "修改拍摄日期", exact: true });
    await checkDialog(date);
    await date.getByLabel("拍摄日期", { exact: true }).fill("2025-04-05");
    await date.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "继续编辑", exact: true }).click();
    await date.getByRole("button", { name: "保存", exact: true }).click();
    await expect(date.getByRole("alert")).toHaveText("测试 date 暂时失败");
    await expect(date.getByLabel("拍摄日期", { exact: true })).toHaveValue("2025-04-05");
    await date.getByRole("button", { name: "保存", exact: true }).click();
    await expect(date).toHaveCount(0);
    saved = (await (await fixtureRequest(page, "GET", root)).json()).album;
    expect(saved.photos.find((photo: { assetId: string }) => photo.assetId === first.assetId).capturedAt).toContain("2025-04-05");
    await selectFirst(); await bar.getByRole("button", { name: "删除", exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "删除照片", exact: true });
    await checkDialog(deletion);
    await deletion.screenshot({ path: testInfo.outputPath("photo-delete-confirmation.png"), scale: "css" });
    await expect(deletion).toContainText("永久删除选中的 1 张照片");
    await deletion.getByRole("button", { name: "取消", exact: true }).click();
    await expect(bar.getByRole("button", { name: "删除", exact: true })).toBeFocused();
    expect(attempts.get("delete")).toBeUndefined(); await expect(bar).toContainText("已选 1 张");
    await bar.getByRole("button", { name: "删除", exact: true }).click();
    await deletion.getByRole("button", { name: "永久删除 1 张照片", exact: true }).click();
    await expect(deletion.getByRole("alert")).toHaveText("测试 delete 暂时失败");
    await deletion.getByRole("button", { name: "永久删除 1 张照片", exact: true }).click();
    await expect(deletion).toHaveCount(0); await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    saved = (await (await fixtureRequest(page, "GET", root)).json()).album;
    expect(saved.coverMediaAssetId).toBe(second.assetId);
    expect(attempts.get("delete")).toBe(2); expect(nativeDialogs).toBe(0);
    await page.getByRole("navigation", { name: "照片筛选" }).getByRole("button", { name: "选择", exact: true }).click();
    await bar.getByRole("button", { name: "全选", exact: true }).click();
    await bar.getByRole("button", { name: "删除", exact: true }).click();
    await deletion.getByRole("button", { name: "永久删除 1 张照片", exact: true }).click();
    await expect(page.locator(".album-photo-tile")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "添加照片", exact: true })).toBeVisible();
    saved = (await (await fixtureRequest(page, "GET", root)).json()).album;
    expect(saved.coverMediaAssetId).toBeNull(); expect(saved.pagination.totalPhotos).toBe(0);
  } finally { await fixtureRequest(page, "DELETE", root); }
});
