import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("add itinerary preserves drafts, retries place notes and resets on reopening", async ({ page }) => {
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/trips", { title: `新增事项-${randomUUID()}`, status: "planning", cities: [], startDate: "2027-03-01", endDate: "2027-03-03", memberIds: ["member-nini"], people: 1 });
  expect(created.status()).toBe(201);
  const { trip } = await created.json(), root = `/api/trips/${trip.slug}`;
  let attempts = 0;
  try {
    expect((await fixtureRequest(page, "POST", `${root}/saved-places`, { placeId: "place-the-bund" })).status()).toBe(201);
    await page.route(`**${root}/plan/items`, route => {
      if (route.request().method() === "POST" && ++attempts === 1) return route.fulfill({ status: 503, json: { error: "测试事项保存失败" } });
      return route.continue();
    });
    await page.goto(`/trips/${trip.slug}/plan?view=planning&member=all`);
    const trigger = page.getByRole("button", { name: "＋ 添加行程", exact: true });
    await trigger.click();
    const editor = page.getByRole("dialog", { name: "添加行程", exact: true });
    await expect(editor.getByRole("radiogroup")).toHaveCount(0);
    for (const width of [320, 375, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const metrics = await editor.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), y: Math.abs(rect.y + rect.height / 2 - innerHeight / 2),
          overflow: element.scrollWidth > element.clientWidth + 1,
          background: getComputedStyle(element).backgroundColor,
          images: [element, ...element.querySelectorAll("*")].filter(item => getComputedStyle(item).backgroundImage !== "none").length };
      });
      expect(metrics.x).toBeLessThanOrEqual(1); expect(metrics.y).toBeLessThanOrEqual(1);
      expect(metrics.overflow).toBe(false); expect(metrics.images).toBe(0); expect(metrics.background).toBe("rgb(255, 250, 240)");
    }
    await expect(editor.getByRole("searchbox")).toBeVisible();
    const before = await editor.getByRole("textbox", { name: "无地点普通活动", exact: true }).boundingBox();
    await editor.getByRole("searchbox").click();
    await expect(editor.getByRole("radio", { name: "选择 外滩", exact: true })).toBeVisible();
    const after = await editor.getByRole("textbox", { name: "无地点普通活动", exact: true }).boundingBox();
    expect(after?.y).toBe(before?.y);
    await editor.getByRole("radio", { name: "选择 外滩", exact: true }).click();
    await editor.getByRole("textbox", { name: "备注（可选）", exact: true }).fill("真实地点备注必须保留");
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "继续编辑", exact: true }).click();
    await editor.getByRole("button", { name: /^加入 / }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试事项保存失败");
    await expect(editor.getByRole("textbox", { name: "备注（可选）", exact: true })).toHaveValue("真实地点备注必须保留");
    const saved = page.waitForResponse(response => new URL(response.url()).pathname === `${root}/plan/items` && response.request().method() === "POST");
    await editor.getByRole("button", { name: /^加入 / }).click();
    const response = await saved; expect(response.status()).toBe(201);
    expect((await response.json()).item.note).toBe("真实地点备注必须保留");
    await expect(editor).toHaveCount(0); await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(editor.getByRole("textbox", { name: "备注（可选）", exact: true })).toHaveValue("");
    await editor.getByRole("textbox", { name: "无地点普通活动", exact: true }).fill("应放弃的活动");
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "放弃修改", exact: true }).click();
    await expect(editor).toHaveCount(0);
  } finally { await fixtureRequest(page, "DELETE", root); }
});

test("ticket editor validates times and keeps activity names out of overnight transport", async ({ page }) => {
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/trips", { title: `跨天交通-${randomUUID()}`, status: "planning", cities: [], startDate: "2027-03-01", endDate: "2027-03-03", memberIds: ["member-nini"], people: 1 });
  expect(created.status()).toBe(201);
  const { trip } = await created.json(), root = `/api/trips/${trip.slug}`;
  let submitted: Record<string, unknown> | undefined;
  try {
    for (const placeId of ["place-the-bund", "place-shanghai-disney"]) expect((await fixtureRequest(page, "POST", `${root}/saved-places`, { placeId })).status()).toBe(201);
    // Capture only the UI contract: this is not a transport persistence test.
    await page.route(`**${root}/bookings`, route => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 503, json: { error: "测试交通保存失败" } });
    });
    await page.goto(`/trips/${trip.slug}/plan?view=planning&member=all`);
    await page.getByRole("button", { name: "＋ 添加行程", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "添加行程", exact: true });
    await editor.getByRole("textbox", { name: "无地点普通活动", exact: true }).fill("不能作为交通名称");
    await editor.getByRole("tab", { name: "地点 / 活动", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(editor.getByRole("tab", { name: "班次 / 票务交通", exact: true })).toHaveAttribute("aria-selected", "true");
    const origin = editor.getByRole("group", { name: "出发地", exact: true }), destination = editor.getByRole("group", { name: "到达地", exact: true });
    await origin.getByRole("searchbox").click(); await origin.getByRole("radio", { name: "选择 外滩", exact: true }).click();
    await destination.getByRole("searchbox").click(); await destination.getByRole("radio", { name: "选择 上海迪士尼度假区", exact: true }).click();
    await editor.getByLabel("交通日期", { exact: true }).fill("2027-03-01");
    await editor.getByRole("combobox", { name: "时间模式", exact: true }).selectOption("range");
    await editor.getByRole("button", { name: /^加入 / }).click();
    await expect(editor.getByRole("alert")).toHaveText("请填写出发时间。"); expect(submitted).toBeUndefined();
    await editor.getByLabel("出发时间", { exact: true }).fill("23:00"); await editor.getByLabel("到达时间", { exact: true }).fill("01:00");
    await editor.getByRole("button", { name: /^加入 / }).click();
    await expect(editor.getByRole("alert")).toHaveText("到达日期和时间不能早于出发。"); expect(submitted).toBeUndefined();
    await editor.getByLabel("到达日期", { exact: true }).fill("2027-03-02");
    await editor.getByRole("textbox", { name: "航班号（可选）", exact: true }).fill("MU123");
    await editor.getByRole("textbox", { name: "预订编号 / PNR（可选）", exact: true }).fill("ABC123");
    await editor.getByRole("textbox", { name: "票价（元，可选）", exact: true }).fill("-1");
    await editor.getByRole("button", { name: /^加入 / }).click();
    await expect(editor.getByRole("alert")).toHaveText("请输入有效票价。"); expect(submitted).toBeUndefined();
    await editor.getByRole("textbox", { name: "票价（元，可选）", exact: true }).fill("125.50");
    await editor.getByRole("button", { name: /^加入 / }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试交通保存失败");
    expect(submitted).toMatchObject({ title: "MU123 · 外滩 → 上海迪士尼度假区", startAt: "2027-03-01T15:00:00.000Z", endAt: "2027-03-01T17:00:00.000Z", bookingReference: "ABC123", totalAmountMinor: 12550, participantMemberIds: ["member-nini"], notes: "班次：MU123" });
    await expect(editor.getByRole("textbox", { name: "预订编号 / PNR（可选）", exact: true })).toHaveValue("ABC123");
  } finally { await fixtureRequest(page, "DELETE", root); }
});
