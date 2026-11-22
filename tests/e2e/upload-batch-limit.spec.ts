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
