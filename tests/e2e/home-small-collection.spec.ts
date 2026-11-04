import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { enterTestSession } from "./session";

test("empty and single-photo collections stay compact without ineffective paging buttons", async ({ page }) => {
  await enterTestSession(page);
  let count = 0;
  const image = await readFile("tests/fixtures/photo.png");
  await page.route("**/small-collection-fixture.png", route => route.fulfill({ contentType: "image/png", body: image }));
  await page.route("**/assets/travel-desk/desk.js*", async route => {
    const response = await route.fetch(), body = await response.text();
    const photos = Array.from({ length: count }, (_, index) => ({ id: `fixture-${index}`, albumId: "fixture", title: "测试收藏", src: "/small-collection-fixture.png", full: "/small-collection-fixture.png" }));
    await route.fulfill({ response, body: body.replace("const escape=value=>", `data={...data,photos:${JSON.stringify(photos)}};const escape=value=>`) });
  });
  for (count of [0, 1]) {
    await page.goto("/");
    const rail = page.locator("#carousel");
    await expect(rail).toBeVisible();
    await expect(rail.locator(".photo")).toHaveCount(count);
    await expect(page.getByRole("button", { name: "上一张收藏照片", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "下一张收藏照片", exact: true })).toBeHidden();
    if (count === 0) expect((await page.locator(".memory-strip").boundingBox())!.height).toBeLessThan(130);
  }
});
