import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("manual map point dialogs retry each unfinished step without recreating the place", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await enterTestSession(page);
  const created = await fixtureRequest(page, "POST", "/api/trips", { title: `地图选点-${randomUUID()}`, status: "planning", cities: ["上海"], startDate: "2027-03-01", endDate: "2027-03-02", memberIds: ["member-nini"], people: 1 });
  expect(created.status()).toBe(201);
  const { trip } = await created.json(), root = `/api/trips/${trip.slug}`;
  let places = 0, attachments = 0, bindings = 0;
  await page.route("**/api/amap/config", route => route.fulfill({ json: { key: "synthetic-key", version: "2.0", serviceHost: "/_AMapService" } }));
  // Isolated SDK event contract only; this does not prove the real AMap service works.
  await page.route("https://webapi.amap.com/maps?**", route => route.fulfill({ contentType: "application/javascript", body: `
    class TestMap {
      constructor(target) { this.events = {}; this.button = document.createElement('button'); this.button.textContent = '选择测试地图坐标'; this.button.onclick = () => (this.events.click || []).forEach(fn => fn({lnglat:{lng:121.4737,lat:31.2304}})); target.appendChild(this.button); }
      on(name, fn) { (this.events[name] ||= []).push(fn); }
      off(name, fn) { this.events[name] = (this.events[name] || []).filter(item => item !== fn); }
      add() {} remove() {} setFitView() {} setCenter() {} resize() {} destroy() { this.button.remove(); }
    }
    window.AMap = { Map: TestMap, Marker: class { on() {} }, Polyline: class {} };
  ` }));
  await page.route(`**${root}/plan/places`, route => {
    if (++places === 1) return route.fulfill({ status: 503, json: { message: "测试地点创建失败" } });
    return route.continue();
  });
  await page.route(`**${root}/saved-places`, route => {
    if (route.request().method() === "POST" && ++attachments === 1) return route.fulfill({ status: 503, json: { message: "测试暂存失败" } });
    return route.continue();
  });
  try {
    const bookingResponse = await fixtureRequest(page, "POST", `${root}/bookings`, { type: "hotel", status: "confirmed", title: "测试待绑定住宿", startDateLocal: "2027-03-01", endDateLocal: "2027-03-02", participantMemberIds: ["member-nini"] });
    expect(bookingResponse.status()).toBe(201); const { booking } = await bookingResponse.json();
    await page.route(`**${root}/budget/bookings/${booking.id}`, route => {
      if (++bindings === 1) return route.fulfill({ status: 503, json: { message: "测试绑定失败" } });
      return route.continue();
    });
    await page.goto(`/trips/${trip.slug}/plan?view=map&mode=library&member=all`);
    const pick = page.frameLocator('iframe[title="高德地图"]').getByRole("button", { name: "选择测试地图坐标", exact: true });
    await pick.click();
    const editor = page.getByRole("dialog", { name: "手动地图选点", exact: true });
    for (const width of [320, 375, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const metrics = await editor.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), y: Math.abs(rect.y + rect.height / 2 - innerHeight / 2),
          overflow: [element, ...element.querySelectorAll("*")].some(node => node.scrollWidth > node.clientWidth + 1),
          background: getComputedStyle(element).backgroundColor,
          images: [element, ...element.querySelectorAll("*")].some(node => getComputedStyle(node).backgroundImage !== "none") };
      });
      expect(metrics.x).toBeLessThanOrEqual(1); expect(metrics.y).toBeLessThanOrEqual(1);
      expect(metrics.overflow).toBe(false); expect(metrics.images).toBe(false); expect(metrics.background).toBe("rgb(255, 250, 240)");
    }
    await page.setViewportSize({ width: testInfo.project.name === "mobile" ? 390 : 1280, height: 844 });
    await editor.getByLabel("名称", { exact: true }).fill(`地图集合点-${randomUUID()}`);
    await editor.getByLabel("地址或备注", { exact: true }).fill("入口见面");
    await expect(editor.getByLabel("同时绑定订单", { exact: true })).toBeVisible();
    await editor.getByLabel("同时绑定订单", { exact: true }).selectOption(booking.id);
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "继续编辑", exact: true }).click();
    await editor.getByRole("button", { name: "保存地点", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试地点创建失败");
    await expect(editor.getByLabel("地址或备注", { exact: true })).toHaveValue("入口见面");
    await editor.getByRole("button", { name: "保存地点", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试暂存失败");
    await expect(editor.getByLabel("名称", { exact: true })).toBeDisabled();
    await editor.getByRole("button", { name: "保存地点", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试绑定失败");
    await expect(editor.getByRole("status")).toHaveText("地点已加入暂存地点。");
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    const discard = page.getByRole("dialog", { name: "放弃未保存修改", exact: true });
    await expect(discard).toContainText("关闭不会删除已保存的地点");
    await discard.getByRole("button", { name: "继续编辑", exact: true }).click();
    await editor.screenshot({ path: testInfo.outputPath("manual-point-retry.png"), scale: "css" });
    const bindingResponse = page.waitForResponse(response => new URL(response.url()).pathname === `${root}/budget/bookings/${booking.id}` && response.request().method() === "PATCH");
    await editor.getByRole("button", { name: "重试绑定订单", exact: true }).click();
    const bound = await bindingResponse; expect(bound.status()).toBe(200);
    const boundBooking = (await bound.json()).booking;
    await expect(editor).toHaveCount(0);
    expect(places).toBe(2); expect(attachments).toBe(2); expect(bindings).toBe(2);
    const stored = (await (await fixtureRequest(page, "GET", `${root}/saved-places`)).json()).savedPlaces;
    expect(stored).toHaveLength(1); expect(stored[0].place.longitude).toBe(121.4737);
    expect(boundBooking.placeId).toBe(stored[0].place.id);
    await page.reload();
    await expect(page.locator(".saved-place-list")).toContainText(stored[0].place.name);
    await pick.click();
    await expect(editor.getByLabel("名称", { exact: true })).toHaveValue("");
    await expect(editor.getByLabel("同时绑定订单", { exact: true })).toHaveValue("");
    await editor.getByLabel("名称", { exact: true }).fill(`独立地点-${randomUUID()}`);
    await editor.getByRole("button", { name: "保存地点", exact: true }).click();
    await expect(editor).toHaveCount(0);
    const updated = (await (await fixtureRequest(page, "GET", `${root}/saved-places`)).json()).savedPlaces;
    expect(updated).toHaveLength(2); expect(bindings).toBe(2);
  } finally { await fixtureRequest(page, "DELETE", root); }
});
