import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { hasCityCoordinates, projectAtlasCities } from "../services/atlas-cities.ts";

test("keeps the book artwork visible under map failures and moves mobile retry clear of the photo", () => {
  const source = readFileSync(new URL("../components/home/CityMapCanvas.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/home/home-live.module.css", import.meta.url), "utf8");
  assert.match(source, /data-map-state=\{error \? "error" : ready \? "ready" : "loading"\}/);
  assert.match(css, /\.compactMap \{[^}]*background: transparent/);
  assert.match(css, /\.compactMap\[data-map-state='error'\] \.mapCanvas \{ visibility: hidden/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.compactMap \.mapStatus \{[^}]*right: 8px;[^}]*max-width: 42%/);
});

test("rejects missing, non-finite and invalid city centers instead of guessing markers", () => {
  const city = { cityId: "test", name: "测试城市", slug: "test", centerLat: 31.23, centerLng: 121.47 };
  assert.equal(hasCityCoordinates(city), true);
  assert.equal(hasCityCoordinates({ ...city, centerLat: null }), false);
  assert.equal(hasCityCoordinates({ ...city, centerLng: NaN }), false);
  assert.equal(hasCityCoordinates({ ...city, centerLat: 91 }), false);
  assert.equal(projectAtlasCities([{ ...city, centerLng: -74 }]).length, 0);
  assert.equal(projectAtlasCities([city]).length, 1);
});

function browserFixture({ failFirst = false, unauthorized = false } = {}) {
  let scripts = [];
  const appended = [];
  const amap = { Map: class {}, Marker: class {}, Polyline: class {} };
  const browser = { setTimeout, clearTimeout, AMap: undefined };
  const document = {
    querySelector: () => scripts[0] || null,
    createElement: () => {
      const element = new EventTarget();
      element.dataset = {};
      element.remove = () => { scripts = scripts.filter((item) => item !== element); };
      return element;
    },
    head: { appendChild: (script) => {
      scripts.push(script); appended.push(script);
      queueMicrotask(() => {
        if (failFirst && appended.length === 1) script.dispatchEvent(new Event("error"));
        else { browser.AMap = amap; script.dispatchEvent(new Event("load")); }
      });
    } },
  };
  let fetches = 0;
  return { browser, document, appended, amap, fetches: () => fetches, fetch: async () => {
    fetches++;
    return Response.json(unauthorized ? { error: "expired" } : { key: "fixture-browser-key", serviceHost: "/_AMapService", version: "2.0" }, { status: unauthorized ? 401 : 200 });
  } };
}

test("shares one SDK request between simultaneous maps and removes failed scripts before retry", async () => {
  const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  try {
    for (const failFirst of [false, true]) {
      const fixture = browserFixture({ failFirst });
      globalThis.window = fixture.browser;
      globalThis.document = fixture.document;
      globalThis.fetch = fixture.fetch;
      const url = new URL("../components/trip/load-amap.ts", import.meta.url);
      url.searchParams.set("case", String(failFirst));
      const { loadAMap } = await import(url.href);
      if (failFirst) await assert.rejects(loadAMap(), /加载失败/);
      const [first, second] = await Promise.all([loadAMap(), loadAMap()]);
      assert.equal(first, fixture.amap); assert.equal(second, fixture.amap);
      assert.equal(fixture.appended.length, failFirst ? 2 : 1);
      assert.equal(fixture.fetches(), failFirst ? 2 : 1);
    }
    const fixture = browserFixture({ unauthorized: true });
    globalThis.window = fixture.browser; globalThis.document = fixture.document; globalThis.fetch = fixture.fetch;
    const { loadAMap } = await import("../components/trip/load-amap.ts?unauthorized");
    await assert.rejects(loadAMap(), /登录已过期/);
    assert.equal(fixture.appended.length, 0);
  } finally { Object.assign(globalThis, previous); }
});
