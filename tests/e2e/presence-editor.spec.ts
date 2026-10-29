import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("day presence restores local times, guards drafts and edits the selected day only", async ({ page }) => {
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/trips", { title: `成员日期-${randomUUID()}`, status: "planning", cities: [], startDate: "2027-03-01", endDate: "2027-03-02", memberIds: ["member-nini", "member-e2e-presence"], people: 2 });
  expect(created.status()).toBe(201);
  const { trip } = await created.json(), root = `/api/trips/${trip.slug}`;
  const [day1, day2] = trip.days;
  let saves = 0;
  try {
    expect((await fixtureRequest(page, "PUT", `${root}/plan/presence`, { dayId: day1.id, members: [
      { memberId: "member-nini", state: "partial", startsAt: "10:15", endsAt: "18:45" }, { memberId: "member-e2e-presence", state: "present" },
    ] })).status()).toBe(200);
    expect((await fixtureRequest(page, "PUT", `${root}/plan/presence`, { dayId: day2.id, members: [
      { memberId: "member-nini", state: "absent" }, { memberId: "member-e2e-presence", state: "absent" },
    ] })).status()).toBe(200);
    await page.route(`**${root}/plan/presence`, route => {
      if (route.request().method() === "PUT" && ++saves === 1) return route.fulfill({ status: 503, json: { error: "测试成员保存失败" } });
      return route.continue();
    });
    await page.goto(`/trips/${trip.slug}/plan?view=planning&day=${day1.id}&member=all`);
    await page.getByRole("button", { name: "当天成员 · 已确认", exact: true }).click();
    const editor = page.getByRole("dialog", { name: /当天成员$/ });
    const nini = editor.getByRole("group", { name: "nini", exact: true });
    await expect(nini.getByRole("radio", { name: "部分在场", exact: true })).toBeChecked();
    await expect(nini.getByLabel("开始时间", { exact: true })).toHaveValue("10:15");
    await expect(nini.getByLabel("结束时间", { exact: true })).toHaveValue("18:45");
    for (const width of [320, 375, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await editor.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), y: Math.abs(rect.y + rect.height / 2 - innerHeight / 2), overflow: element.scrollWidth > element.clientWidth + 1,
          images: [element, ...element.querySelectorAll("*")].filter(item => getComputedStyle(item).backgroundImage !== "none").length, background: getComputedStyle(element).backgroundColor };
      });
      expect(layout.x).toBeLessThanOrEqual(1); expect(layout.y).toBeLessThanOrEqual(1);
      expect(layout.overflow).toBe(false); expect(layout.images).toBe(0); expect(layout.background).toBe("rgb(255, 250, 240)");
    }
    await nini.getByLabel("开始时间", { exact: true }).fill("11:30");
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "继续编辑", exact: true }).click();
    await editor.getByRole("button", { name: "保存当天成员", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试成员保存失败");
    await expect(nini.getByLabel("开始时间", { exact: true })).toHaveValue("11:30");
    await editor.getByRole("button", { name: "保存当天成员", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await page.getByRole("button", { name: "当天成员 · 已确认", exact: true }).click();
    await expect(nini.getByLabel("开始时间", { exact: true })).toHaveValue("11:30");
    await editor.getByRole("button", { name: /^关闭/ }).click();
    await page.getByRole("navigation", { name: "选择日期" }).getByRole("link").nth(1).click();
    await expect(page).toHaveURL(new RegExp(`day=${day2.id}`));
    await page.getByRole("button", { name: "当天成员 · 已确认", exact: true }).click();
    await expect(nini.getByRole("radio", { name: "不在场", exact: true })).toBeChecked();
    await editor.getByRole("button", { name: "全员在场", exact: true }).click();
    const savedDay = page.waitForResponse(response => new URL(response.url()).pathname === `${root}/plan/presence` && response.request().method() === "PUT");
    await editor.getByRole("button", { name: "保存当天成员", exact: true }).click();
    const saved = await savedDay; expect(saved.status()).toBe(200); expect(saved.request().postDataJSON().dayId).toBe(day2.id);
    await expect(editor).toHaveCount(0);
    const firstDay = await fixtureRequest(page, "GET", `${root}/plan/presence?dayId=${day1.id}`);
    expect((await firstDay.json()).details["member-nini"]).toMatchObject({ state: "partial", startsAt: "2027-03-01T03:30:00.000Z", endsAt: "2027-03-01T10:45:00.000Z" });
    await page.reload();
    await page.getByRole("button", { name: "当天成员 · 已确认", exact: true }).click();
    await expect(nini.getByRole("radio", { name: "在场", exact: true })).toBeChecked();
    await nini.getByRole("radio", { name: "部分在场", exact: true }).click();
    await nini.getByLabel("开始时间", { exact: true }).fill(""); await nini.getByLabel("结束时间", { exact: true }).fill("");
    await editor.getByRole("button", { name: "保存当天成员", exact: true }).click();
    await expect(editor.getByRole("alert")).toContainText("需填写开始和结束时间");
    await nini.getByLabel("开始时间", { exact: true }).fill("18:00"); await nini.getByLabel("结束时间", { exact: true }).fill("10:00");
    await editor.getByRole("button", { name: "保存当天成员", exact: true }).click();
    await expect(editor.getByRole("alert")).toContainText("结束时间必须晚于开始时间");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "放弃修改", exact: true }).click();
    await expect(page.getByRole("button", { name: "当天成员 · 已确认", exact: true })).toBeFocused();
  } finally { await fixtureRequest(page, "DELETE", root); }
});
