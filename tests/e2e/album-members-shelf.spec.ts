import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {enterTestSession,fixtureRequest} from "./session";
test.beforeEach(async({page})=>enterTestSession(page));
test("album members are selectable and book dragging does not open a book",async({page})=>{
  let fileChoosers=0;page.on("filechooser",()=>fileChoosers++);
  const ids:string[]=[];const title=`人员与拖动-${Date.now()}`;
  try{
    await page.goto("/albums");await page.getByRole("button",{name:"添加相册",exact:true}).click();
    const dialog=page.getByRole("dialog",{name:"添加相册",exact:true});
    await dialog.getByLabel("相册标题",{exact:true}).fill(title);
    await dialog.getByRole("checkbox",{name:"kiki",exact:true}).check();
    await page.screenshot({path:`work/album-members-editor-${test.info().project.name}.png`,fullPage:true});
    await dialog.getByRole("button",{name:"创建相册",exact:true}).click();
    await expect(page).toHaveURL(/\/albums\/.+/);ids.push(new URL(page.url()).pathname.split("/").at(-1)!);
    const created=await(await fixtureRequest(page,"GET",`/api/albums/${ids[0]}`)).json();
    expect(created.album.memberIds).toContain("member-zhu-jingqi");
    await page.goto("/albums");
    await expect(page.getByRole("button",{name:"上一组相册",exact:true})).toBeHidden();
    await expect(page.getByRole("button",{name:"下一组相册",exact:true})).toBeHidden();
    for(let i=0;i<5;i++){const response=await fixtureRequest(page,"POST","/api/albums",{title:`拖动样本-${i}-${Date.now()}`});ids.push((await response.json()).album.id);}
    await page.goto("/albums");
    await expect(page.getByRole("button",{name:"下一组相册",exact:true})).toBeEnabled();
    await expect(page.getByRole("button",{name:"上一组相册",exact:true})).toBeDisabled();
    const shelf=page.locator(".album-drag-shelf");const bounds=(await shelf.boundingBox())!;
    await page.mouse.move(bounds.x+bounds.width*.75,bounds.y+Math.min(bounds.height*.65,240));await page.mouse.down();await page.mouse.move(bounds.x+30,bounds.y+Math.min(bounds.height*.65,240),{steps:12});await page.mouse.up();
    expect(await shelf.evaluate(el=>el.scrollLeft)).toBeGreaterThan(40);await expect(page).toHaveURL(/\/albums$/);
    expect(fileChoosers).toBe(0);
  }finally{for(const id of ids)await fixtureRequest(page,"DELETE",`/api/albums/${id}`);}
});
test("homepage favorites follow dragging without opening the photo",async({page})=>{
  const image=await readFile("tests/fixtures/photo.png");
  await page.route("**/desk-drag-fixture.png",route=>route.fulfill({contentType:"image/png",body:image}));
  await page.route("**/assets/travel-desk/desk.js*",async route=>{
    const response=await route.fetch();const body=await response.text();
    await route.fulfill({response,body:body.replace('const escape=value=>','data={...data,photos:Array.from({length:15},(_,i)=>({id:"fixture-"+i,albumId:"fixture",title:"测试照片"+i,src:"/desk-drag-fixture.png",full:"/desk-drag-fixture.png"}))};const escape=value=>')});
  });
  await page.goto("/");const rail=page.locator("#carousel");await expect(rail.locator(".photo")).toHaveCount(15);
  await rail.scrollIntoViewIfNeeded();
  const bounds=(await rail.boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+40);await page.mouse.down();await page.mouse.move(bounds.x+20,bounds.y+40,{steps:12});await page.mouse.up();
  expect(await rail.evaluate(el=>el.scrollLeft)).toBeGreaterThan(40);await expect(page.locator("#lightbox")).not.toBeVisible();
});
