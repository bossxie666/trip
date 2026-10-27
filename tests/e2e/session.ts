import { expect, type Cookie, type Page } from "@playwright/test";

// One revocable session per isolated Playwright worker avoids login rate-limit
// noise as coverage grows. Only synthetic local credentials are used here.
let cookies: Cookie[] = [];
export async function enterTestSession(page: Page) {
  if (!cookies.length) {
    const response = await page.request.post("/api/session", { data: { memberName: "nini", code: "test-invite" } });
    expect(response.status()).toBe(200);
    cookies = await page.context().cookies();
    expect(cookies.some(cookie => cookie.value.startsWith("v2."))).toBe(true);
  } else await page.context().addCookies(cookies);
}
