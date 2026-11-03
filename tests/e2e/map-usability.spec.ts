import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("arbitrary trip cities filter map search and repeated places do not request transport", async ({ page }) => {
  await enterTestSession(page);
  const response = await fixtureRequest(page, "POST", "/api/trips", { title: `通用地图-${randomUUID()}`, status: "planning", cities: ["西宁", "成都"], startDate: "2027-04-01", endDate: "2027-04-01", memberIds: ["member-nini"], people: 1 });
  expect(response.status()).toBe(201);
  const { trip } = await response.json(), root = `/api/trips/${trip.slug}`;
  let routeRequests = 0;
  const searches: URL[] = [];
  // These checks exercise filters and request contracts, not the external SDK.
  await page.route("**/api/amap/config", route => route.fulfill({ status: 503, json: { error: "测试不加载外部地图" } }));
  await page.route(`**${root}/plan/routes`, route => { routeRequests++; return route.fulfill({ status: 400, json: { error: "不应为同地点请求路线" } }); });
  await page.route("**/api/amap/places/search?**", route => { searches.push(new URL(route.request().url())); return route.fulfill({ json: { pois: [] } }); });
  try {
    const city = trip.cities.find((city: { name: string }) => city.name === "西宁");
    const chengdu = trip.cities.find((city: { name: string }) => city.name === "成都");
    const created = await fixtureRequest(page, "POST", `${root}/plan/places`, { name: "重复集合点", cityId: city.id, latitude: 36.6, longitude: 101.8 });
    expect(created.status()).toBe(201);
    const { place } = await created.json();
    for (let index = 0; index < 2; index++) expect((await fixtureRequest(page, "POST", `${root}/plan/items`, { dayId: trip.days[0].id, placeId: place.id, itemType: "place" })).status()).toBe(201);
    await page.goto(`/trips/${trip.slug}/plan?view=planning&member=all`);
    await expect(page.getByRole("heading", { name: "重复集合点", exact: true })).toHaveCount(2);
    await expect(page.getByText("同一地点，无需交通", { exact: true })).toBeVisible();
    await page.goto(`/trips/${trip.slug}/plan?view=map&member=all`);
    await expect(page.getByText("同一地点，无需交通", { exact: true })).toBeVisible();
    expect(routeRequests).toBe(0);
    await page.getByRole("combobox", { name: "选择地图视图", exact: true }).selectOption("library");
    const regions = page.locator(".map-filter-row").filter({ has: page.getByText("地域", { exact: true }) });
    await expect(regions.getByRole("button")).toHaveText(["全部", "西宁", "成都"]);
    await regions.getByRole("button", { name: "成都", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`area=${chengdu.id}`));
    await page.reload();
    await expect(regions.getByRole("button", { name: "成都", exact: true })).toHaveClass("active");
    await page.getByRole("textbox", { name: "地图搜索地点", exact: true }).fill("餐厅");
    await expect.poll(() => searches.at(-1)?.searchParams.get("cityId")).toBe(chengdu.id);
    expect(searches.at(-1)?.searchParams.get("region")).toBe("成都");
    await regions.getByRole("button", { name: "全部", exact: true }).click();
    await expect.poll(() => searches.at(-1)?.searchParams.get("cityId")).toBe(null);
    expect(routeRequests).toBe(0);
  } finally { await fixtureRequest(page, "DELETE", root); }
});

test("profile shortcuts guard drafts and reach knowledge and persona without changing the navbar", async ({ page }) => {
  await enterTestSession(page);
  await page.goto("/trips");
  await page.locator(".site-header .member-identity-trigger").click();
  const profile = page.getByRole("dialog", { name: "个人资料", exact: true });
  await profile.getByRole("button", { name: "修改密码", exact: true }).click();
  await profile.getByLabel("当前密码", { exact: true }).fill("synthetic-unsaved");
  await profile.getByRole("link", { name: "知识库", exact: true }).click();
  const discard = page.getByRole("dialog", { name: "放弃未保存修改", exact: true });
  await discard.getByRole("button", { name: "取消", exact: true }).click();
  await expect(profile.getByLabel("当前密码", { exact: true })).toHaveValue("synthetic-unsaved");
  await profile.getByRole("link", { name: "知识库", exact: true }).click();
  await discard.getByRole("button", { name: "放弃修改", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await page.locator(".site-header .member-identity-trigger").click();
  await profile.getByRole("link", { name: "我的形象", exact: true }).click();
  await expect(page).toHaveURL(/\/persona$/);
  await expect(page.getByRole("heading", { name: "3D形象准备中", exact: true })).toBeVisible();
});
