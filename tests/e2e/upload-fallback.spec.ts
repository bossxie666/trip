import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { enterTestSession, fixtureRequest } from "./session";

for (const failure of ["http", "network"]) test(`photo upload falls back after direct ${failure} failure`, async ({ page }) => {
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/albums", { title: `备用上传-${randomUUID()}`, tripId: "trip-e2e" });
  expect(created.status()).toBe(201);
  const { album } = await created.json();
  let authorizations = 0, transfers = 0;
  await page.route("**/api/media/uploads", async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    authorizations++;
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, uploadUrl: "https://synthetic-upload.invalid/photo" } });
  });
  await page.route("https://synthetic-upload.invalid/photo", route => failure === "http" ? route.fulfill({ status: 403 }) : route.abort("failed"));
  page.on("request", request => { if (/\/api\/media\/uploads\/[^/]+\/content$/.test(new URL(request.url()).pathname)) transfers++; });
  try {
    await page.goto(`/albums/${album.id}`);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click();
    await (await chooser).setFiles("tests/fixtures/photo.png");
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    expect({ authorizations, transfers }).toEqual({ authorizations: 1, transfers: 1 });
    await page.reload();
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});
