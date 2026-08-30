import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the Travel Archive home", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /跳进地理书/);
  assert.match(html, /进入攻略/);
});

test("renders the Trips index from Trip data", async () => {
  const response = await render("/trips");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /攻略/);
  assert.match(html, /上海 \+ 杭州/);
  assert.match(html, /待出行/);
  assert.match(html, /shanghai-hangzhou-2026/);
});

test("renders the migrated Shanghai Hangzhou Trip Detail", async () => {
  const response = await render("/trips/shanghai-hangzhou-2026");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /上海＋杭州/);
  assert.match(html, /我的个人消费/);
  assert.match(html, /同行人自助计算/);
  assert.match(html, /杭州东与杭州南/);
  assert.doesNotMatch(html, /Starter Project|react-loading-skeleton/);
});

test("renders reserved city album and map routes", async () => {
  const [citiesResponse, cityResponse, mapResponse] = await Promise.all([
    render("/cities"), render("/cities/shanghai"), render("/map"),
  ]);
  assert.equal(citiesResponse.status, 200);
  assert.equal(cityResponse.status, 200);
  assert.equal(mapResponse.status, 200);
  assert.match(await citiesResponse.text(), /城市影集/);
  assert.match(await cityResponse.text(), /上海/);
  assert.match(await mapResponse.text(), /旅行地图/);
});
