import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { enterTestSession, fixtureRequest } from "./session";

test("photo decode stall survives refresh and retry completes without decoding dimensions", async ({ page }) => {
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/albums", { title: `手机恢复-${randomUUID()}`, tripId: "trip-e2e" });
  expect(created.status()).toBe(201);
  const { album } = await created.json();
  let transfers = 0;
  page.on("request", request => { if (request.method() === "PUT") transfers++; });
  await page.addInitScript(() => {
    window.Image = class { onload = null; onerror = null; naturalWidth = 0; naturalHeight = 0; src = ""; } as unknown as typeof Image;
  });
  try {
    await page.goto(`/albums/${album.id}`);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click();
    await (await chooser).setFiles("tests/fixtures/photo.png");
    await expect.poll(() => page.evaluate(() => new Promise<string | undefined>((resolve, reject) => {
      const open = indexedDB.open("trip-photo-uploads", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction("queues"), read = tx.objectStore("queues").getAll();
        read.onsuccess = () => resolve(read.result[0]?.items[0]?.attempt?.stage);
        tx.oncomplete = () => db.close();
      };
    }))).toBe("读取图片尺寸");
    await page.reload();
    await expect(page.locator(".album-upload-status")).toContainText("读取图片尺寸");
    await page.getByRole("button", { name: "重试失败的 1 张", exact: true }).click();
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    expect(transfers).toBe(1);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});
