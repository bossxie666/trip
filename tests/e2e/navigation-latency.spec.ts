import { test, expect } from "@playwright/test";
import { enterTestSession } from "./session";
test.use({hasTouch:true});

test("touch navigation avoids speculative fetch and signals the pending destination immediately", async ({page}) => {
  await enterTestSession(page);
  await page.goto("/messages");
  const link=page.locator(".site-mobile-nav a[href='/trips']");
  const target=await link.isVisible()?link:page.locator(".site-header nav a[href='/trips']");
  let requests=0;
  let release:()=>void=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/trips?*", async route=>{
    if(new URL(route.request().url()).searchParams.has("_rsc")) {requests++;await held;}
    await route.continue();
  });
  try {
    await target.dispatchEvent("pointerover",{pointerType:"touch",bubbles:true});
    await target.dispatchEvent("touchstart",{bubbles:true});
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    expect(requests).toBe(0);
    await target.tap();
    await expect(target).toHaveAttribute("aria-busy","true");
    await expect.poll(()=>requests).toBe(1);
    await target.tap();
    expect(requests).toBe(1);
    release();
    await expect(page).toHaveURL(/\/trips$/);
    await expect(page.locator(".trip-list")).toBeVisible();
  }finally{release();}
});
