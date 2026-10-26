/** The custom-style endpoint is hosted on webapi, unlike REST services.
 * Keep both destinations fixed; this endpoint must never become an open proxy. */
export function amapProxyUrl(path: string, incoming: URL, securityCode: string) {
  if (!/^v[345]\/[A-Za-z0-9/_-]+$/.test(path)) return null;
  const host = path === "v4/map/styles" ? "https://webapi.amap.com/" : "https://restapi.amap.com/";
  const upstream = new URL(path, host);
  incoming.searchParams.forEach((value, key) => { if (key !== "jscode") upstream.searchParams.append(key, value); });
  upstream.searchParams.set("jscode", securityCode);
  return upstream;
}
