import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { enterTestSession, fixtureRequest } from "./session";

test("album accepts more than twenty photos in one selection", async ({ page }) => {
  test.setTimeout(120_000);
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/albums", { title: `批量测试-${randomUUID()}`, tripId: "trip-e2e" });
  expect(created.status()).toBe(201);
  const { album } = await created.json();
  try {
    await page.goto(`/albums/${album.id}`);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click();
    const buffer = readFileSync("tests/fixtures/photo.png");
    await (await chooser).setFiles(Array.from({ length: 21 }, (_, i) => ({ name: `batch-${i}.png`, mimeType: "image/png", buffer })));
    await expect(page.locator(".album-photo-tile")).toHaveCount(21, { timeout: 90_000 });
    await page.reload();
    await expect(page.locator(".album-photo-tile")).toHaveCount(21);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("10MB photo traverses authorization, content and confirmation", async ({ page }) => {
  await enterTestSession(page);
  const buffer = Buffer.alloc(10 * 1024 * 1024);
  readFileSync("tests/fixtures/photo.png").copy(buffer);
  const response = await fixtureRequest(page, "POST", "/api/media/uploads", { purpose: "album", filename: "ten-mb.png", contentType: "image/png", byteSize: buffer.length });
  expect(response.status()).toBe(201);
  const { assetId } = await response.json();
  const cookie = (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join("; ");
  const put = await page.request.put(`/api/media/uploads/${assetId}/content`, { data: buffer, headers: { cookie, "content-type": "image/png" } });
  expect(put.status()).toBe(200);
  expect((await fixtureRequest(page, "POST", `/api/media/uploads/${assetId}/complete`, {})).status()).toBe(200);
});

test("streamed uploads reject mismatched size and allow a clean retry", async ({ page }) => {
  await enterTestSession(page);
  const buffer = readFileSync("tests/fixtures/photo.png");
  const authorized = await fixtureRequest(page, "POST", "/api/media/uploads", { purpose: "album", filename: "bounded.png", contentType: "image/png", byteSize: buffer.length });
  expect(authorized.status()).toBe(201);
  const { assetId } = await authorized.json();
  const cookie = (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join("; ");
  const path = `/api/media/uploads/${assetId}/content`;
  expect((await fixtureRequest(page, "POST", `/api/media/uploads/${assetId}/complete`, {})).status()).toBe(409);
  expect((await page.request.put(path, { data: buffer.subarray(1), headers: { cookie, "content-type": "image/png" } })).status()).toBe(400);
  expect((await fixtureRequest(page, "POST", `/api/media/uploads/${assetId}/complete`, {})).status()).toBe(409);
  expect((await page.request.put(path, { data: buffer, headers: { cookie, "content-type": "image/png" } })).status()).toBe(200);
  expect((await fixtureRequest(page, "POST", `/api/media/uploads/${assetId}/complete`, {})).status()).toBe(200);
});

test("direct image handler enforces login and immediately revoked album membership", async ({ page, browser }) => {
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/albums", { title: `图片权限-${randomUUID()}`, memberIds: ["member-zhu-jingqi"] });
  const { album } = await created.json();
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:8787" });
  try {
    const bytes = readFileSync("tests/fixtures/photo.png");
    const authorization = await fixtureRequest(page, "POST", "/api/media/uploads", { purpose: "album", filename: "private.png", contentType: "image/png", byteSize: bytes.length });
    const { assetId } = await authorization.json();
    const cookie = (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join("; ");
    expect((await page.request.put(`/api/media/uploads/${assetId}/content`, { data: bytes, headers: { cookie, "content-type": "image/png" } })).status()).toBe(200);
    expect((await fixtureRequest(page, "POST", `/api/media/uploads/${assetId}/complete`, {})).status()).toBe(200);
    expect((await fixtureRequest(page, "POST", `/api/albums/${album.id}/media`, { assetIds: [assetId] })).status()).toBe(200);
    const image = `/api/media/${assetId}?variant=thumb`;
    expect((await other.request.get(image)).status()).toBe(401);
    expect((await other.request.post("/api/session", { data: { memberName: "kiki", code: "test-invite" } })).status()).toBe(200);
    const otherCookie = (await other.cookies()).map(c => `${c.name}=${c.value}`).join("; ");
    expect((await other.request.get(image, { headers: { cookie: otherCookie } })).status()).toBe(200);
    expect((await fixtureRequest(page, "PATCH", `/api/albums/${album.id}`, { memberIds: [] })).status()).toBe(200);
    const denied = await other.request.get(image, { headers: { cookie: otherCookie } });
    expect(denied.status()).toBe(404);
    expect(denied.headers()["cache-control"]).toContain("no-store");
    expect((await page.request.get(image, { headers: { cookie } })).status()).toBe(200);
  } finally { await other.close(); await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("browser generates a private thumbnail while retaining the original", async ({ page, browser }) => {
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/albums", { title: `浏览器缩略图-${randomUUID()}` });
  const { album } = await created.json();
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:8787" });
  try {
    await page.goto(`/albums/${album.id}`);
    const encoded = await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1200;
      const ctx = canvas.getContext("2d")!, gradient = ctx.createLinearGradient(0, 0, 1200, 1200);
      gradient.addColorStop(0, "#204b3a"); gradient.addColorStop(1, "#e8dab8"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 1200);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const saved = page.waitForResponse(response => /\/variants\/thumb$/.test(new URL(response.url()).pathname) && response.request().method() === "PUT");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click();
    await (await chooser).setFiles({ name: "large.png", mimeType: "image/png", buffer: Buffer.from(encoded, "base64") });
    const response = await saved;
    expect(response.status()).toBe(200);
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    const { album: detail } = await (await fixtureRequest(page, "GET", `/api/albums/${album.id}`)).json();
    const asset = detail.photos[0].assetId;
    await page.reload();
    await expect.poll(() => page.locator(".album-photo-tile img").evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(480);
    const cookie = (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join("; ");
    expect((await page.request.get(`/api/media/${asset}?variant=display`, { headers: { cookie } })).headers()["content-type"]).toBe("image/png");
    expect((await other.request.post("/api/session", { data: { memberName: "kiki", code: "test-invite" } })).status()).toBe(200);
    const otherCookie = (await other.cookies()).map(c => `${c.name}=${c.value}`).join("; ");
    expect((await other.request.put(`/api/media/${asset}/variants/thumb`, { data: Buffer.from("invalid"), headers: { cookie: otherCookie, "content-type": "image/webp" } })).status()).toBe(403);
  } finally { await other.close(); await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});
