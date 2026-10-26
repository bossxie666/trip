import type { AMapNamespace } from "./amap-client-types";
import { bridgeAMapRealm } from "./amap-realm";

export async function createAMapFrame(host: HTMLDivElement, signal: AbortSignal) {
  const frame = document.createElement("iframe");
  frame.title = "高德地图";
  frame.style.cssText = "display:block;width:100%;height:100%;border:0";
  const dispose = () => frame.remove();
  signal.addEventListener("abort", dispose, { once: true });
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => finish(new Error("地图容器加载超时，请重试。")), 8000);
      const onAbort = () => finish(new Error("地图加载已取消。"));
      function finish(error?: Error) {
        window.clearTimeout(timer); signal.removeEventListener("abort", onAbort);
        frame.onload = null; frame.onerror = null;
        if (error) reject(error); else resolve();
      }
      frame.onload = () => finish(); frame.onerror = () => finish(new Error("地图容器加载失败。"));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    frame.src = "/api/amap/canvas";
    host.appendChild(frame);
    const configPromise = fetch("/api/amap/config", { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) }).then(async (response) => {
      const config = await response.json() as { key?: string; version?: string; serviceHost?: string; error?: string };
      if (!response.ok || !config.key || !config.serviceHost) throw new Error(config.error || "地图配置读取失败。");
      return config;
    });
    const [, config] = await Promise.all([loaded, configPromise]);
    const scope = frame.contentWindow, target = frame.contentDocument?.querySelector<HTMLDivElement>("#map");
    if (!scope || !target || signal.aborted) throw new Error("地图容器不可用，请重试。");
    scope._AMapSecurityConfig = { serviceHost: config.serviceHost! };
    await new Promise<void>((resolve, reject) => {
      const script = frame.contentDocument!.createElement("script");
      const timer = window.setTimeout(() => finish(new Error("高德地图加载超时，请重试。")), 8000);
      const onAbort = () => finish(new Error("地图加载已取消。"));
      function finish(error?: Error) {
        window.clearTimeout(timer); signal.removeEventListener("abort", onAbort);
        script.onload = null; script.onerror = null;
        if (error) reject(error); else resolve();
      }
      script.src = `https://webapi.amap.com/maps?v=${encodeURIComponent(config.version || "2.0")}&key=${encodeURIComponent(config.key!)}`;
      script.async = true; script.onload = () => finish(); script.onerror = () => finish(new Error("高德地图加载失败。"));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort(); else frame.contentDocument!.head.appendChild(script);
    });
    if (!scope.AMap) throw new Error("高德地图加载失败。");
    return { AMap: bridgeAMapRealm(scope.AMap as AMapNamespace, scope as unknown as { Array: ArrayConstructor; Object: ObjectConstructor }), target, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
