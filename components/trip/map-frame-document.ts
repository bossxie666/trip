/** A frame can become readable before its load notification reaches the parent. */
export function waitForMapDocument(frame: HTMLIFrameElement, signal: AbortSignal, timeoutMs = 15000, pollMs = 100) {
  return new Promise<void>((resolve, reject) => {
    let poll: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const timeout = setTimeout(() => finish(new Error("地图容器加载超时，请重试。")), timeoutMs);
    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(poll);
      frame.removeEventListener("load", check);
      frame.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve();
    }
    function check() {
      if (settled) return;
      // Do not accept the initial about:blank document or a login/error page.
      if (frame.contentDocument?.querySelector("#map")) finish();
    }
    function inspect() {
      check();
      if (!settled) poll = setTimeout(inspect, pollMs);
    }
    function failed() { finish(new Error("地图容器加载失败，请重试。")); }
    function aborted() { finish(new Error("地图加载已取消。")); }
    frame.addEventListener("load", check);
    frame.addEventListener("error", failed);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted(); else inspect();
  });
}
