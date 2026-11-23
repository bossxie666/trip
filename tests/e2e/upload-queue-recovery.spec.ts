import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { enterTestSession, fixtureRequest } from "./session";

test("oversized photos are compressed locally before authorization", async ({ page }) => {
  await enterTestSession(page);
  const { album } = await (await fixtureRequest(page, "POST", "/api/albums", { title: `自动压缩-${randomUUID()}` })).json();
  const original = Buffer.concat([readFileSync("tests/fixtures/photo.png"), Buffer.alloc(10 * 1024 * 1024)]);
  let authorizedSize = 0, authorizedType = "";
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/media/uploads") { const body = request.postDataJSON(); authorizedSize = body.byteSize; authorizedType = body.contentType; } });
  try {
    await page.goto(`/albums/${album.id}`);
    const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "添加照片", exact: true }).click();
    await (await chooser).setFiles({ name: "oversized.png", mimeType: "image/png", buffer: original });
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    expect(authorizedSize).toBeGreaterThan(0); expect(authorizedSize).toBeLessThan(10 * 1024 * 1024); expect(authorizedType).toBe("image/jpeg");
    expect(original.length).toBeGreaterThan(10 * 1024 * 1024);
    await page.reload(); await expect(page.locator(".album-photo-tile")).toHaveCount(1);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("failed task names survive refresh even when photo storage cannot write", async ({ page }) => {
  await enterTestSession(page);
  const { album } = await (await fixtureRequest(page, "POST", "/api/albums", { title: `独立任务记录-${randomUUID()}` })).json();
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === "files") throw new DOMException("full", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });
  await page.route("**/api/media/uploads/*/content", route => route.fulfill({ status: 400, body: "synthetic failure" }));
  try {
    await page.goto(`/albums/${album.id}`);
    const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "添加照片", exact: true }).click();
    await (await chooser).setFiles("tests/fixtures/photo.png");
    await expect(page.locator(".album-upload-status")).toContainText("本次未完成 1 张");
    await page.reload();
    await expect(page.locator(".album-upload-status")).toContainText("上次未完成 1 张");
    await expect(page.locator(".album-upload-status")).toContainText("photo.png");
    await expect(page.locator(".album-upload-status")).toContainText("照片文件未保留");
    await page.unroute("**/api/media/uploads/*/content");
    const replacement = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "重新选择", exact: true }).click();
    await (await replacement).setFiles("tests/fixtures/photo.png");
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    await page.reload(); await expect(page.locator(".album-photo-tile")).toHaveCount(1); await expect(page.locator(".album-upload-status")).toHaveCount(0);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("phone provider files upload even when JavaScript file reads fail", async ({ page }) => {
  await enterTestSession(page);
  const { album } = await (await fixtureRequest(page, "POST", "/api/albums", { title: `手机文件-${randomUUID()}` })).json();
  await page.addInitScript(() => {
    File.prototype.slice = function () { throw new DOMException("Provider cannot slice", "NotReadableError"); };
    File.prototype.arrayBuffer = function () { return Promise.reject(new DOMException("Provider cannot read", "NotReadableError")); };
  });
  try {
    await page.goto(`/albums/${album.id}`);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click();
    await (await chooser).setFiles("tests/fixtures/photo.png");
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    await expect(page.locator(".album-upload-status")).toContainText("已添加 1 张");
    await page.reload();
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("photo bytes are stored once while progress metadata changes repeatedly", async ({ page }) => {
  await enterTestSession(page);
  const { album } = await (await fixtureRequest(page, "POST", "/api/albums", { title: `存储-${randomUUID()}` })).json();
  await page.addInitScript(() => {
    const counters = { files: 0, progress: 0 }, put = IDBObjectStore.prototype.put;
    Object.defineProperty(window, "uploadStorageProbe", { get: () => counters });
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === "files" && value instanceof Blob) counters.files++;
      if (this.name === "queues") counters.progress++;
      return put.call(this, value, key);
    };
  });
  try {
    await page.goto(`/albums/${album.id}`);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click();
    const buffer = readFileSync("tests/fixtures/photo.png");
    await (await chooser).setFiles(["one.png", "two.png"].map(name => ({ name, mimeType: "image/png", buffer })));
    await expect(page.locator(".album-photo-tile")).toHaveCount(2);
    const counts = await page.evaluate(() => Reflect.get(window, "uploadStorageProbe"));
    expect(counts.files).toBe(2); expect(counts.progress).toBeGreaterThan(8);
    const remaining = await page.evaluate(() => new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("trip-photo-uploads"); request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result, tx = db.transaction("files"), count = tx.objectStore("files").count(); count.onsuccess = () => resolve(count.result); tx.oncomplete = () => db.close(); };
    }));
    expect(remaining).toBe(0);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("legacy phone upload records survive the storage upgrade and retry", async ({ page }) => {
  await enterTestSession(page);
  const { album } = await (await fixtureRequest(page, "POST", "/api/albums", { title: `旧记录-${randomUUID()}` })).json();
  try {
    await page.goto("/albums");
    await page.evaluate(({ id, bytes }) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("trip-photo-uploads", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("queues"); request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result, tx = db.transaction("queues", "readwrite");
        tx.objectStore("queues").put({ updatedAt: Date.now(), items: [{ file: new File([new Uint8Array(bytes)], "legacy.png", { type: "image/png" }), status: "error", error: "图片上传过于频繁，请稍后再试。" }] }, `member-nini:${id}`);
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    }), { id: album.id, bytes: [...readFileSync("tests/fixtures/photo.png")] });
    await page.goto(`/albums/${album.id}`);
    await expect(page.locator(".album-upload-status")).toContainText("上次未完成 1 张");
    await expect(page.locator(".album-upload-status")).toContainText("legacy.png");
    await page.getByRole("button", { name: "重试失败的 1 张", exact: true }).click();
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    await page.reload(); await expect(page.locator(".album-photo-tile")).toHaveCount(1);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("empty and oversized files explain the cause and can be reselected without spending authorization quota", async ({ page }) => {
  await enterTestSession(page); let authorizations = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/media/uploads") authorizations++; });
  const { album } = await (await fixtureRequest(page, "POST", "/api/albums", { title: `文件恢复-${randomUUID()}` })).json();
  try {
    await page.goto(`/albums/${album.id}`);
    const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "添加照片", exact: true }).click();
    await (await chooser).setFiles([{ name: "empty.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) }, { name: "large.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }]);
    const status = page.locator(".album-upload-status");
    await expect(status).toContainText("本次未完成 2 张");
    await expect(status).toContainText("未读取到照片文件"); await expect(status).toContainText("手机无法解码");
    expect(authorizations).toBe(0);
    const replacement = page.waitForEvent("filechooser");
    await status.getByRole("listitem").filter({ hasText: "empty.jpg" }).getByRole("button", { name: "重新选择", exact: true }).click();
    await (await replacement).setFiles("tests/fixtures/photo.png");
    await expect(page.locator(".album-photo-tile")).toHaveCount(1); expect(authorizations).toBe(1);
    await status.getByRole("listitem").filter({ hasText: "large.jpg" }).getByRole("button", { name: "移除任务", exact: true }).click();
    await expect(status.getByRole("listitem")).toHaveCount(0);
    await page.reload(); await expect(page.locator(".album-photo-tile")).toHaveCount(1);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("an unresponsive transfer can be paused and retried using the same authorization", async ({ page }) => {
  await enterTestSession(page); let authorizations = 0, held = false, release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const { album } = await (await fixtureRequest(page, "POST", "/api/albums", { title: `暂停-${randomUUID()}` })).json();
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/media/uploads") authorizations++; });
  await page.route("**/api/media/uploads/*/content", async route => { if (!held) { held = true; await wait; await route.abort().catch(() => {}); } else await route.continue(); });
  try {
    await page.goto(`/albums/${album.id}`); const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click(); await (await chooser).setFiles("tests/fixtures/photo.png");
    await expect.poll(() => held).toBe(true);
    await page.getByRole("button", { name: "暂停上传", exact: true }).click();
    await expect(page.locator(".album-upload-status")).toContainText("上传已暂停");
    await expect(page.getByRole("button", { name: "重试失败的 1 张", exact: true })).toBeEnabled();
    release(); await page.getByRole("button", { name: "重试失败的 1 张", exact: true }).click();
    await expect(page.locator(".album-photo-tile")).toHaveCount(1); expect(authorizations).toBe(1);
  } finally { release(); await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("storage quota failure warns once and does not rewrite photos at every checkpoint", async ({ page }) => {
  await enterTestSession(page);
  const { album } = await (await fixtureRequest(page, "POST", "/api/albums", { title: `存储不可用-${randomUUID()}` })).json();
  await page.addInitScript(() => {
    let attempts = 0; const put = IDBObjectStore.prototype.put;
    Object.defineProperty(window, "failedFileWrites", { get: () => attempts });
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === "files") { attempts++; throw new DOMException("full", "QuotaExceededError"); }
      return put.call(this, value, key);
    };
  });
  try {
    await page.goto(`/albums/${album.id}`); const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click(); await (await chooser).setFiles("tests/fixtures/photo.png");
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    await expect(page.getByRole("alert")).toContainText("本次上传请勿刷新");
    expect(await page.evaluate(() => Reflect.get(window, "failedFileWrites"))).toBe(1);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});
