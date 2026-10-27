import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".lighthouseci");
const expected = new Set(["/", "/trips", "/trips/shanghai-hangzhou-2026/plan?view=planning", "/trips/shanghai-hangzhou-2026/plan?view=budget"]);
const results = [];
for (const name of await readdir(root)) {
  if (!/^lhr-.*\.json$/.test(name)) continue;
  const report = JSON.parse(await readFile(resolve(root, name), "utf8"));
  const requested = new URL(report.requestedUrl);
  const final = new URL(report.finalDisplayedUrl || report.finalUrl);
  const key = requested.pathname + requested.search;
  if (report.runtimeError) throw new Error(`Lighthouse runtime failure: ${report.runtimeError.code}`);
  if (!expected.has(key) || final.pathname + final.search !== key) throw new Error(`Performance run did not reach its authenticated route: ${key}`);
  if (report.audits["http-status-code"]?.score !== 1) throw new Error(`Performance route failed: ${key}`);
  const metrics = { route: key, performance: report.categories.performance.score, fcpMs: report.audits["first-contentful-paint"].numericValue, lcpMs: report.audits["largest-contentful-paint"].numericValue, cls: report.audits["cumulative-layout-shift"].numericValue, tbtMs: report.audits["total-blocking-time"].numericValue, transferBytes: report.audits["total-byte-weight"].numericValue };
  results.push(metrics);
  console.log(JSON.stringify(metrics));
}
for (const route of expected) if (results.filter(result => result.route === route).length < 2) throw new Error(`Missing repeated performance measurements: ${route}`);
