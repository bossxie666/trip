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

export async function fixtureRequest(page: Page, method: string, path: string, data?: unknown) {
  if (!path.startsWith("/api/")) throw new Error("Fixture requests must stay on the local API");
  // Browser navigation correctly honors Secure cookies on loopback. Playwright's
  // separate HTTP client does not send them over local HTTP, so fixture setup
  // supplies the already-issued synthetic session explicitly. Production cookie
  // attributes and actual browser/UI requests remain unchanged.
  const cookie = (await page.context().cookies()).filter(item => item.domain === "127.0.0.1")
    .map(item => `${item.name}=${item.value}`).join("; ");
  if (!cookie) throw new Error("Synthetic local session is missing");
  return page.request.fetch(path, { method, data, headers: { cookie } });
}
