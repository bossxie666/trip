import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { enterTestSession, fixtureRequest } from "./session";

test.beforeEach(async ({ page }) => enterTestSession(page));

test("trip book editing preserves dates and members across conflict, cancellation and retry", async ({ page }) => {
  const title = `旅行资料-${randomUUID()}`;
  const response = await fixtureRequest(page, "POST", "/api/trips", {
    title, status: "planning", cities: [], startDate: "2027-02-01", endDate: "2027-02-02", people: 1, memberIds: ["member-nini"],
  });
  expect(response.status()).toBe(201);
  const { trip } = await response.json();
  const apiPath = `/api/trips/${encodeURIComponent(trip.slug)}`;
  let updates = 0;
  await page.route(`**${apiPath}`, route => {
    if (route.request().method() !== "PUT") return route.continue();
    updates += 1;
    if (updates === 1) return route.fulfill({ status: 409, json: { error: "测试日期冲突，请保留当前输入。" } });
    return route.continue();
  });
  try {
    await page.goto("/trips");
    await page.getByRole("button", { name: `编辑旅行：${title}`, exact: true }).click();
    const editor = page.getByRole("dialog", { name: "编辑旅行", exact: true });
    await editor.getByRole("textbox", { name: "名称", exact: true }).fill(`${title}-修改`);
    await editor.getByLabel("结束日期", { exact: true }).fill("2027-02-03");
    await editor.getByRole("checkbox", { name: "kiki", exact: true }).check();
    await editor.getByRole("button", { name: `删除行程：${title}`, exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "删除行程", exact: true });
    await expect(deletion.getByRole("button", { name: "确认删除", exact: true })).toBeVisible();
    await deletion.getByRole("button", { name: "取消", exact: true }).click();
    await expect(editor.getByRole("textbox", { name: "名称", exact: true })).toHaveValue(`${title}-修改`);
    await expect(editor.getByLabel("结束日期", { exact: true })).toHaveValue("2027-02-03");
    await expect(editor.getByRole("checkbox", { name: "kiki", exact: true })).toBeChecked();
    await editor.getByRole("button", { name: "关闭编辑旅行", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "继续编辑", exact: true }).click();
    await editor.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("测试日期冲突，请保留当前输入。");
    await expect(editor.getByLabel("结束日期", { exact: true })).toHaveValue("2027-02-03");
    await expect(editor.getByRole("checkbox", { name: "kiki", exact: true })).toBeChecked();
    await editor.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await page.getByRole("button", { name: `编辑旅行：${title}-修改`, exact: true }).click();
    await expect(editor.getByRole("textbox", { name: "名称", exact: true })).toHaveValue(`${title}-修改`);
    await expect(editor.getByLabel("开始日期", { exact: true })).toHaveValue("2027-02-01");
    await expect(editor.getByLabel("结束日期", { exact: true })).toHaveValue("2027-02-03");
    await expect(editor.getByRole("checkbox", { name: "nini", exact: true })).toBeChecked();
    await expect(editor.getByRole("checkbox", { name: "kiki", exact: true })).toBeChecked();
    await editor.getByRole("checkbox", { name: "日期未定", exact: true }).check();
    await expect(editor.getByLabel("开始日期", { exact: true })).toHaveCount(0);
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog", { name: "放弃未保存修改", exact: true }).getByRole("button", { name: "放弃修改", exact: true }).click();
    await page.getByRole("button", { name: `编辑旅行：${title}-修改`, exact: true }).click();
    await expect(editor.getByRole("checkbox", { name: "日期未定", exact: true })).not.toBeChecked();
    const box = await editor.boundingBox(), viewport = page.viewportSize()!;
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
    await expect(editor).toHaveCSS("background-image", "none");
  } finally { await fixtureRequest(page, "DELETE", apiPath); }
});

test("album editors guard unsaved input, retry failures and require a separate delete confirmation", async ({ page }) => {
  const title = `相册-${randomUUID()}`;
  let albumId: string | undefined, creations = 0;
  let releaseFailure: (() => void) | undefined;
  await page.route("**/api/albums", async route => {
    if (route.request().method() !== "POST") return route.continue();
    creations += 1;
    if (creations === 1) {
      await new Promise<void>(resolve => { releaseFailure = resolve; });
      return route.fulfill({ status: 503, json: { message: "测试创建失败，请重试。" } });
    }
    return route.continue();
  });
  try {
    await page.goto("/albums");
    await page.getByRole("button", { name: "添加相册", exact: true }).click();
    const create = page.getByRole("dialog", { name: "添加相册", exact: true });
    await create.getByLabel("相册标题", { exact: true }).fill(title);
    await create.getByRole("button", { name: "取消", exact: true }).click();
    const discard = page.getByRole("dialog", { name: "放弃未保存修改", exact: true });
    await expect(discard.getByRole("button", { name: "继续编辑", exact: true })).toBeFocused();
    await discard.getByRole("button", { name: "继续编辑", exact: true }).click();
    await expect(create.getByLabel("相册标题", { exact: true })).toHaveValue(title);
    await create.getByRole("button", { name: "创建相册", exact: true }).click();
    await expect(create.getByRole("button", { name: "保存中…", exact: true })).toBeDisabled();
    await expect.poll(() => creations).toBe(1);
    await page.keyboard.press("Enter");
    expect(creations).toBe(1);
    releaseFailure!();
    await expect(create.getByRole("alert")).toHaveText("测试创建失败，请重试。");
    await expect(create.getByLabel("相册标题", { exact: true })).toHaveValue(title);
    const created = page.waitForResponse(response => new URL(response.url()).pathname === "/api/albums" && response.request().method() === "POST");
    await create.getByRole("button", { name: "创建相册", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    albumId = (await response.json()).album.id;
    await expect(page).toHaveURL(new RegExp(`/albums/${albumId}$`));
    expect(creations).toBe(2);

    await page.goto("/albums");
    await page.getByRole("button", { name: `编辑相册：${title}`, exact: true }).click();
    const editor = page.getByRole("dialog", { name: "编辑相册", exact: true });
    await editor.getByLabel("标题", { exact: true }).fill(`${title}-未保存`);
    await editor.getByRole("button", { name: "删除相册", exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "删除相册", exact: true });
    await expect(deletion).toContainText("0 张照片");
    await expect(deletion.getByRole("button", { name: "确认删除", exact: true })).toBeVisible();
    await deletion.getByRole("button", { name: "取消", exact: true }).click();
    await expect(editor.getByLabel("标题", { exact: true })).toHaveValue(`${title}-未保存`);
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await discard.getByRole("button", { name: "放弃修改", exact: true }).click();
    await expect(page.getByRole("button", { name: `编辑相册：${title}`, exact: true })).toBeFocused();
    await page.getByRole("button", { name: `编辑相册：${title}`, exact: true }).click();
    await expect(editor.getByLabel("标题", { exact: true })).toHaveValue(title);
    const box = await editor.boundingBox(), viewport = page.viewportSize()!;
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
    await expect(editor).toHaveCSS("background-image", "none");
    await editor.getByLabel("标题", { exact: true }).fill(`${title}-已保存`);
    await editor.getByRole("combobox", { name: "关联旅行", exact: true }).selectOption("trip-e2e");
    await editor.getByRole("textbox", { name: "简介", exact: true }).fill("合成相册资料。");
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await page.getByRole("button", { name: `编辑相册：${title}-已保存`, exact: true }).click();
    await expect(editor.getByLabel("标题", { exact: true })).toHaveValue(`${title}-已保存`);
    await expect(editor.getByRole("combobox", { name: "关联旅行", exact: true })).toHaveValue("trip-e2e");
    await expect(editor.getByRole("textbox", { name: "简介", exact: true })).toHaveValue("合成相册资料。");
  } finally {
    releaseFailure?.();
    if (albumId) await fixtureRequest(page, "DELETE", `/api/albums/${albumId}`);
  }
});

test("item editing keeps unsaved input, discards explicitly and saves the selected day", async ({ page }) => {
  const title = `事项-${randomUUID()}`;
  const created = await fixtureRequest(page, "POST", "/api/trips/e2e-shanghai/plan/items", { title, dayId: "trip-e2e-day-1", itemType: "note", timeMode: "all_day" });
  expect(created.status()).toBe(201);
  const { item } = await created.json();
  try {
    await page.goto("/trips/e2e-shanghai/plan?view=planning&day=trip-e2e-day-1&member=all");
    const record = page.locator("article.timeline-node").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await record.getByRole("button", { name: "编辑事项", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "编辑事项", exact: true });
    await expect(editor.getByRole("combobox", { name: "时间模式", exact: true })).toHaveValue("all_day");
    await editor.getByLabel("标题", { exact: true }).fill(`${title}-未保存`);
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    const discard = page.getByRole("dialog", { name: "放弃未保存修改", exact: true });
    await expect(discard).toBeVisible();
    await expect(discard.getByRole("button", { name: "继续编辑", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(editor.getByLabel("标题", { exact: true })).toHaveValue(`${title}-未保存`);
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await discard.getByRole("button", { name: "放弃修改", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(record.getByRole("button", { name: "编辑事项", exact: true })).toBeFocused();
    await record.getByRole("button", { name: "编辑事项", exact: true }).click();
    await expect(editor.getByLabel("标题", { exact: true })).toHaveValue(title);
    const box = await editor.boundingBox(), viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
    await expect(editor).toHaveCSS("background-image", "none");
    await editor.getByLabel("标题", { exact: true }).fill(`${title}-已保存`);
    await editor.getByRole("combobox", { name: "日期", exact: true }).selectOption("trip-e2e-day-2");
    await editor.getByRole("button", { name: "保存并移动", exact: true }).click();
    await expect(page).toHaveURL(/day=trip-e2e-day-2/);
    await expect(page.getByRole("heading", { name: `${title}-已保存`, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: `${title}-已保存`, exact: true })).toBeVisible();
  } finally { await fixtureRequest(page, "DELETE", `/api/trips/e2e-shanghai/plan/items/${item.id}`); }
});

test("shared knowledge can be created, added to a day and read with the latest title", async ({ page }) => {
  const title = `知识-${randomUUID()}`;
  let entryId: string | undefined, itemIds: string[] = [];
  try {
    await page.goto(`/knowledge?q=${encodeURIComponent(title)}`);
    await page.getByRole("button", { name: "添加知识", exact: true }).first().click();
    const editor = page.getByRole("dialog", { name: "添加知识", exact: true });
    await editor.getByRole("combobox", { name: "栏目", exact: true }).selectOption("travel_guide");
    await editor.getByLabel("标题", { exact: true }).fill(title);
    await editor.getByLabel("正文", { exact: true }).fill("隔离环境的合成攻略正文。");
    const created = page.waitForResponse(response => new URL(response.url()).pathname === "/api/knowledge" && response.request().method() === "POST");
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    entryId = (await response.json()).entry.id;
    await expect(editor).toHaveCount(0);
    await page.goto("/trips/e2e-shanghai/plan?view=planning&day=trip-e2e-day-1&member=all");
    await page.getByRole("button", { name: "从知识库添加", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "从知识库添加", exact: true });
    await picker.getByRole("textbox", { name: "搜索知识", exact: true }).fill(title);
    const row = picker.locator("article").filter({ hasText: title });
    await expect(row).toHaveCount(1);
    const added = page.waitForResponse(response => response.url().endsWith("/knowledge-items") && response.request().method() === "POST");
    await row.getByRole("button", { name: "添加", exact: true }).click();
    const addResponse = await added;
    expect(addResponse.status()).toBe(200);
    expect(await addResponse.json()).toMatchObject({ ok: true, count: 1 });
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    const itemId = await page.locator("article.timeline-node").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).getAttribute("data-timeline-node-id");
    expect(itemId).toBeTruthy();
    itemIds = [itemId!];
    const updatedTitle = `${title}-更新`;
    const updated = await fixtureRequest(page, "PATCH", `/api/knowledge/${entryId}`, { section: "travel_guide", title: updatedTitle, body: "更新后的合成正文。" });
    expect(updated.status()).toBe(200);
    await page.reload();
    await expect(page.getByRole("heading", { name: updatedTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `查看知识：${updatedTitle}`, exact: true })).toHaveAttribute("href", `/knowledge/${entryId}`);
  } finally {
    for (const id of itemIds) await fixtureRequest(page, "DELETE", `/api/trips/e2e-shanghai/plan/items/${id}`);
    if (entryId) await fixtureRequest(page, "DELETE", `/api/knowledge/${entryId}`);
  }
});

test("partial photo uploads keep successes and retry only the failed attachment", async ({ page }) => {
  test.setTimeout(60_000);
  const created = await fixtureRequest(page, "POST", "/api/albums", { title: `上传-${randomUUID()}`, tripId: "trip-e2e" });
  expect(created.status()).toBe(201);
  const { album } = await created.json();
  let attachments = 0, authorizations = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/media/uploads" && request.method() === "POST") authorizations += 1; });
  await page.route(`**/api/albums/${album.id}/media`, async route => {
    if (route.request().method() === "POST" && ++attachments === 2) await route.fulfill({ status: 503, json: { message: "合成测试：附加暂时失败。" } });
    else await route.continue();
  });
  try {
    await page.goto(`/albums/${album.id}`);
    await expect(page.getByRole("button", { name: "添加照片", exact: true })).toBeVisible();
    const buffer = await readFile("tests/fixtures/photo.png");
    await page.locator("input.album-floating-input").setInputFiles([{ name: "photo.png", mimeType: "image/png", buffer }, { name: "second.png", mimeType: "image/png", buffer }]);
    await expect(page.locator(".album-photo-tile")).toHaveCount(1);
    await page.getByRole("button", { name: "重试失败的 1 张", exact: true }).click();
    await expect(page.locator(".album-photo-tile")).toHaveCount(2);
    expect(authorizations).toBe(2);
    expect(attachments).toBe(3);
    await page.getByRole("button", { name: "查看photo.png", exact: true }).click();
    const viewer = page.getByRole("dialog", { name: "照片预览", exact: true });
    await expect(viewer.getByRole("img", { name: "photo.png", exact: true })).toBeVisible();
    await viewer.getByRole("button", { name: "下一张", exact: true }).click();
    await expect(viewer.getByRole("img", { name: "second.png", exact: true })).toBeVisible();
    await viewer.getByRole("button", { name: "关闭", exact: true }).click();
    await page.getByRole("button", { name: "选择", exact: true }).click();
    await page.getByRole("button", { name: "全选", exact: true }).click();
    await expect(page.locator(".album-selection-bar")).toContainText("已选 2 张");
    await page.locator(".album-selection-bar").getByRole("button", { name: "收藏", exact: true }).click();
    await page.getByRole("navigation", { name: "照片筛选" }).getByRole("button", { name: "收藏", exact: true }).click();
    await expect(page.locator(".album-photo-tile")).toHaveCount(2);
  } finally { await fixtureRequest(page, "DELETE", `/api/albums/${album.id}`); }
});

test("map configuration failure stays local and leaves chapter navigation usable", async ({ page }) => {
  await page.route("**/api/amap/config", route => route.fulfill({ status: 503, json: { error: "测试地图服务暂不可用。" } }));
  await page.goto("/trips/e2e-shanghai/plan?view=map&member=all");
  await expect(page.getByRole("button", { name: "重新加载地图", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "工作台视图" })).toBeVisible();
  await page.getByRole("navigation", { name: "工作台视图" }).getByRole("link", { name: "费用", exact: true }).click();
  await expect(page).toHaveURL(/view=budget/);
  await expect(page.getByRole("navigation", { name: "工作台视图" })).toBeVisible();
  await expect(page.getByText("行程读取失败", { exact: true })).toHaveCount(0);
});
