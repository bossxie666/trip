import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("place discovery opens on the selected day, preserves failed additions and resets drafts", async ({ page }) => {
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/trips", { title: `想去地点-${randomUUID()}`, status: "planning", cities: [], startDate: "2027-03-01", endDate: "2027-03-02", memberIds: ["member-nini"], people: 1 });
  expect(created.status()).toBe(201);
  const { trip } = await created.json(), root = `/api/trips/${trip.slug}`;
  let attempts = 0;
  try {
    expect((await fixtureRequest(page, "POST", `${root}/saved-places`, { placeId: "place-the-bund" })).status()).toBe(201);
    await page.route(`**${root}/plan/items`, route => {
      if (route.request().method() === "POST" && ++attempts === 1) return route.fulfill({ status: 503, json: { error: "测试加入日期失败" } });
      return route.continue();
    });
    await page.goto(`/trips/${trip.slug}/plan?view=planning&day=${trip.days[1].id}&member=all&area=hangzhou&category=food&mode=library&cost=actual&q=%E8%A5%BF%E6%B9%96`);
    const trigger = page.getByRole("button", { name: "找想去的地方", exact: true });
    await trigger.click();
    const editor = page.getByRole("dialog", { name: "找想去的地方", exact: true });
    await expect(editor.getByRole("combobox", { name: "目标日期", exact: true })).toHaveValue(trip.days[1].id);
    await expect(editor.getByRole("radiogroup")).toHaveCount(0);
    await editor.getByRole("searchbox").click();
    await editor.getByRole("radio", { name: "选择 外滩", exact: true }).click();
    for (const width of [320, 375, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await editor.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), y: Math.abs(rect.y + rect.height / 2 - innerHeight / 2),
          overflow: element.scrollWidth > element.clientWidth + 1, background: getComputedStyle(element).backgroundColor,
          images: [element, ...element.querySelectorAll("*")].filter(item => getComputedStyle(item).backgroundImage !== "none").length };
      });
      expect(layout.x).toBeLessThanOrEqual(1); expect(layout.y).toBeLessThanOrEqual(1);
      expect(layout.overflow).toBe(false); expect(layout.images).toBe(0); expect(layout.background).toBe("rgb(255, 250, 240)");
    }
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "继续编辑", exact: true }).click();
    await expect(editor.getByRole("status")).toHaveText("已选择：外滩");
    await editor.getByRole("button", { name: "加入行程", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试加入日期失败");
    await expect(editor.getByRole("status")).toHaveText("已选择：外滩");
    const saved = page.waitForResponse(response => new URL(response.url()).pathname === `${root}/plan/items` && response.request().method() === "POST");
    await editor.getByRole("button", { name: "加入行程", exact: true }).click();
    const response = await saved; expect(response.status()).toBe(201);
    expect((await response.json()).item).toMatchObject({ dayId: trip.days[1].id, placeId: "place-the-bund" });
    await expect(editor).toHaveCount(0);
    const location = new URL(page.url());
    for (const [key, value] of Object.entries({ member: "all", area: "hangzhou", category: "food", mode: "library", cost: "actual", q: "西湖" })) expect(location.searchParams.get(key)).toBe(value);
    await trigger.click();
    await expect(editor.getByRole("status")).toHaveCount(0);
    await editor.getByRole("searchbox").click(); await editor.getByRole("radio", { name: "选择 外滩", exact: true }).click();
    const savedWish = page.waitForResponse(result => new URL(result.url()).pathname === `${root}/saved-places` && result.request().method() === "POST");
    await editor.getByRole("button", { name: "加入想去", exact: true }).click();
    expect((await savedWish).status()).toBe(201);
    await expect(editor).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.getByRole("navigation", { name: "选择日期" }).getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`day=${trip.days[0].id}`));
    await trigger.click();
    await expect(editor.getByRole("combobox", { name: "目标日期", exact: true })).toHaveValue(trip.days[0].id);
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await expect(editor).toHaveCount(0);
  } finally { await fixtureRequest(page, "DELETE", root); }
});
