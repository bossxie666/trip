import {test,expect} from "@playwright/test";
import {enterTestSession} from "./session";

test.beforeEach(async({page})=>enterTestSession(page));
test("returns to the open chapter and keeps compact view-all entries",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/");await page.locator("#scene-open").click();
  await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state","open");
  await page.waitForTimeout(300);await page.locator("#scene-next").click();
  await expect(page.locator("#scene-wrap")).toHaveAttribute("data-page","2");
  const links=page.locator("#chapter-links");expect(await links.locator('a:not(.chapter-view-all)').count()).toBeLessThanOrEqual(2);
  await links.getByRole("link",{name:"查看全部旅行 →",exact:true}).click();await expect(page).toHaveURL(/\/trips$/);
  await page.getByRole("link",{name:"首页",exact:true}).first().click();
  await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state","open");await expect(page.locator("#scene-wrap")).toHaveAttribute("data-page","2");
  await page.locator("#scene-next").click();await expect(page.locator("#scene-wrap")).toHaveAttribute("data-page","3");
  await page.locator("#chapter-links").getByRole("link",{name:"查看全部相册 →",exact:true}).click();await expect(page).toHaveURL(/\/albums$/);
  await page.goBack();await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state","open");await expect(page.locator("#scene-wrap")).toHaveAttribute("data-page","3");
  await page.reload();await expect(page.locator("#scene-wrap")).toHaveAttribute("data-page","3");await expect(page.locator("#scene-open")).not.toBeVisible();
  await page.waitForTimeout(2000);await page.locator("#scene-close").click();await expect(page.locator("#scene-wrap")).toHaveAttribute("data-state","closed");
  await page.reload();await expect(page.locator("#scene-open")).toBeVisible();
});
test("opens the supplied 3D book, changes chapters, closes and returns safely",async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")console.error("Homepage console:",message.text());});
  await page.goto("/");
  const wrap=page.locator("#scene-wrap");
  await expect(page.locator("#scene-open")).toBeVisible();
  await page.locator("#scene-open").click();
  await expect(wrap).toHaveAttribute("data-state","open");
  await expect(wrap).toHaveAttribute("data-page","1");
  await page.screenshot({path:"work/home-desk-open.png",fullPage:true});
  await page.waitForTimeout(300);
  await page.locator("#scene-next").click();
  await expect(wrap).toHaveAttribute("data-page","2");
  await expect(page.locator("#chapter-links")).toContainText("上海测试旅行");
  await page.waitForTimeout(2200);
  await page.locator("#scene-next").click();
  await expect(wrap).toHaveAttribute("data-page","3");
  await page.waitForTimeout(2200);
  await page.locator("#scene-close").click();
  await expect(wrap).toHaveAttribute("data-state","closed");
  await expect(page.locator("#chapter-links")).toHaveText("");
  const emptyCollection=page.locator(".memory-strip.is-empty");
  if(await emptyCollection.count())expect((await emptyCollection.boundingBox())!.height).toBeLessThan(70);
  expect(await page.locator("audio").getAttribute("src")).toBeNull();
  for(const width of [320,375,390,430,1024,1360]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    if(width===390||width===1360)await page.screenshot({path:`work/home-desk-${width}.png`,fullPage:true});
  }
  await page.getByRole("link",{name:"我的旅行",exact:true}).first().click();
  await expect(page).toHaveURL(/\/trips$/);
  await page.getByRole("link",{name:"首页",exact:true}).first().click();
  await expect(page.locator("#scene-open")).toBeVisible();
  expect(errors).toEqual([]);
});
