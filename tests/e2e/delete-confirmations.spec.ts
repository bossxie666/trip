import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test("expense and itinerary deletion use site dialogs, preserve drafts and retry failures", async ({ page }, testInfo) => {
  await enterTestSession(page);
  const tripResponse = await fixtureRequest(page, "POST", "/api/trips", { title: `删除确认-${randomUUID()}`, status: "planning", cities: [], startDate: "2027-03-01", endDate: "2027-03-02", memberIds: ["member-nini"], people: 1 });
  expect(tripResponse.status()).toBe(201);
  const { trip } = await tripResponse.json(), root = `/api/trips/${trip.slug}`;
  let nativePrompts = 0, expenseDeletes = 0, itemDeletes = 0;
  page.on("dialog", async dialog => { nativePrompts++; await dialog.dismiss(); });
  try {
    const expenseTitle = `费用${randomUUID().replaceAll("-", "").repeat(3)}`, itemTitle = `事项${randomUUID().replaceAll("-", "").repeat(3)}`;
    const expenseResponse = await fixtureRequest(page, "POST", `${root}/budget/expenses`, { title: expenseTitle, amountMinor: 12550, category: "food", scope: "personal", dayId: trip.days[0].id });
    expect(expenseResponse.status()).toBe(201);
    const expenseId = (await expenseResponse.json()).expense.id;
    const itemResponse = await fixtureRequest(page, "POST", `${root}/plan/items`, { title: itemTitle, dayId: trip.days[0].id, itemType: "activity" });
    expect(itemResponse.status()).toBe(201);
    const itemId = (await itemResponse.json()).item.id;
    await page.route(`**${root}/budget/expenses/${expenseId}`, route => {
      if (route.request().method() === "DELETE" && ++expenseDeletes === 1) return route.fulfill({ status: 503, json: { error: "测试费用删除失败" } });
      return route.continue();
    });
    await page.route(`**${root}/plan/items/${itemId}`, route => {
      if (route.request().method() === "DELETE" && ++itemDeletes === 1) return route.fulfill({ status: 503, json: { error: "测试事项删除失败" } });
      return route.continue();
    });
    await page.goto(`/trips/${trip.slug}/plan?view=budget&cost=actual&member=all`);
    const expense = page.locator(".budget-expenses article").filter({ hasText: expenseTitle });
    await expense.getByRole("button", { name: "编辑费用", exact: true }).click();
    const expenseEditor = page.getByRole("dialog", { name: "编辑费用", exact: true });
    await expenseEditor.getByRole("textbox", { name: "名称", exact: true }).fill("尚未保存的费用名称");
    await expenseEditor.getByRole("button", { name: "删除费用", exact: true }).click();
    const expenseConfirm = page.getByRole("dialog", { name: "删除费用", exact: true });
    await expect(expenseConfirm).toContainText(expenseTitle); expect(expenseDeletes).toBe(0);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await expenseConfirm.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: Math.abs(rect.x + rect.width / 2 - innerWidth / 2), y: Math.abs(rect.y + rect.height / 2 - innerHeight / 2), overflow: element.scrollWidth > element.clientWidth + 1 || [...element.querySelectorAll("p")].some(item => item.scrollWidth > item.clientWidth + 1),
          background: getComputedStyle(element).backgroundColor, images: [element, ...element.querySelectorAll("*")].filter(item => getComputedStyle(item).backgroundImage !== "none").length };
      });
      expect(layout.x).toBeLessThanOrEqual(1); expect(layout.y).toBeLessThanOrEqual(1); expect(layout.overflow).toBe(false); expect(layout.background).toBe("rgb(255, 250, 240)"); expect(layout.images).toBe(0);
      if (width === 390) await page.screenshot({ path: testInfo.outputPath("expense-delete-390.png"), scale: "css" });
    }
    await expenseConfirm.getByRole("button", { name: "取消", exact: true }).click();
    await expect(expenseEditor.getByRole("textbox", { name: "名称", exact: true })).toHaveValue("尚未保存的费用名称");
    await expenseEditor.getByRole("button", { name: "删除费用", exact: true }).click();
    await expenseConfirm.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(expenseConfirm.getByRole("alert")).toHaveText("测试费用删除失败");
    await expenseConfirm.getByRole("button", { name: "取消", exact: true }).click();
    await expect(expenseEditor.getByRole("textbox", { name: "名称", exact: true })).toHaveValue("尚未保存的费用名称");
    await expenseEditor.getByRole("button", { name: "删除费用", exact: true }).click();
    const deletedExpense = page.waitForResponse(response => new URL(response.url()).pathname === `${root}/budget/expenses/${expenseId}` && response.request().method() === "DELETE");
    await expenseConfirm.getByRole("button", { name: "确认删除", exact: true }).click();
    expect((await deletedExpense).status()).toBe(200); await expect(expenseConfirm).toHaveCount(0); await expect(expense).toHaveCount(0);

    await page.goto(`/trips/${trip.slug}/plan?view=planning&day=${trip.days[0].id}&member=all`);
    const item = page.locator("article.timeline-node").filter({ hasText: itemTitle });
    await item.getByRole("button", { name: "编辑事项", exact: true }).click();
    const itemEditor = page.getByRole("dialog", { name: "编辑事项", exact: true });
    await itemEditor.getByRole("textbox", { name: "标题", exact: true }).fill("尚未保存的事项名称");
    await itemEditor.getByRole("button", { name: "删除这一条", exact: true }).click();
    const itemConfirm = page.getByRole("dialog", { name: "删除行程事项", exact: true });
    await expect(itemConfirm).toContainText(itemTitle); expect(itemDeletes).toBe(0);
    await page.keyboard.press("Escape");
    await expect(itemEditor.getByRole("textbox", { name: "标题", exact: true })).toHaveValue("尚未保存的事项名称");
    await itemEditor.getByRole("button", { name: "删除这一条", exact: true }).click();
    await itemConfirm.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(itemConfirm.getByRole("alert")).toHaveText("测试事项删除失败");
    await itemConfirm.getByRole("button", { name: "取消", exact: true }).click();
    await expect(itemEditor.getByRole("textbox", { name: "标题", exact: true })).toHaveValue("尚未保存的事项名称");
    await itemEditor.getByRole("button", { name: "删除这一条", exact: true }).click();
    const deletedItem = page.waitForResponse(response => new URL(response.url()).pathname === `${root}/plan/items/${itemId}` && response.request().method() === "DELETE");
    await itemConfirm.getByRole("button", { name: "确认删除", exact: true }).click();
    expect((await deletedItem).status()).toBe(200); await expect(itemConfirm).toHaveCount(0); await expect(item).toHaveCount(0);
    expect(nativePrompts).toBe(0);
  } finally { await fixtureRequest(page, "DELETE", root); }
});
