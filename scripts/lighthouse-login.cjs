module.exports = async (browser) => {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8787/unlock", { waitUntil: "domcontentloaded" });
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/session", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberName: "nini", code: "test-invite" }),
    });
    return { ok: result.ok, status: result.status };
  });
  await page.close();
  if (!response.ok) throw new Error(`Lighthouse login failed (${response.status})`);
};
