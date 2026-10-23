import type { AMapNamespace } from "./amap-client-types";

let loader: Promise<AMapNamespace> | null = null;

/** One retryable SDK loader shared by the itinerary map and Homepage Atlas. */
export function loadAMap(): Promise<AMapNamespace> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loader) return loader;
  loader = (async () => {
    const response = await fetch("/api/amap/config", { signal: AbortSignal.timeout(8_000) });
    if (response.status === 401) throw new Error("登录已过期，请重新登录后查看地图。");
    const config = await response.json() as { key?: string; version?: string; serviceHost?: string; error?: string };
    if (!response.ok || !config.key || !config.serviceHost) throw new Error(config.error || "地图配置读取失败。");
    window._AMapSecurityConfig = { serviceHost: config.serviceHost };
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-trip-amap]");
      const script = existing || document.createElement("script");
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
        // A failed element must be removed, or retry would wait forever for
        // an already-fired error/load event from the previous SDK request.
        if (error) { script.remove(); reject(error); }
        else resolve();
      };
      const onLoad = () => finish(window.AMap ? undefined : new Error("高德地图初始化失败，请重试。"));
      const onError = () => finish(new Error("高德地图加载失败，请重试。"));
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
      const timeout = window.setTimeout(() => finish(new Error("高德地图加载超时，请重试。")), 8_000);
      if (!existing) {
        script.dataset.tripAmap = "true";
        script.src = `https://webapi.amap.com/maps?v=${encodeURIComponent(config.version || "2.0")}&key=${encodeURIComponent(config.key!)}`;
        script.async = true;
        document.head.appendChild(script);
      }
    });
    if (!window.AMap) throw new Error("高德地图加载失败。");
    return window.AMap;
  })().catch((error) => {
    loader = null;
    throw error instanceof Error ? error : new Error("地图暂时无法连接，请重试。");
  });
  return loader;
}
