export const mapCanvasPath = "/api/amap/canvas";

// The SDK's WebGL renderer uses dynamic compilation. Keep that exception in
// this empty map document, never in the page containing forms and user content.
export const mapCanvasCsp = "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://*.amap.com https://*.autonavi.com; style-src 'unsafe-inline' https://*.amap.com; img-src data: blob: https:; font-src data: https:; connect-src 'self' https:; worker-src blob:; frame-src 'self' blob: https://*.amap.com";

export function mapCanvasResponse() {
  return new Response('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>高德地图</title><style>html,body,#map{width:100%;height:100%;margin:0;overflow:hidden}body{background:#f5f3ed}</style></head><body><div id="map" role="region" aria-label="高德地图"></div></body></html>', {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
