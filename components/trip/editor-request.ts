export async function editorRequest<T extends object = Record<string, unknown>>(url: string, init: RequestInit = {}): Promise<T> {
  try {
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
    const response = await fetch(url, { ...init, signal });
    const payload = await response.json().catch(() => { throw new Error("服务响应异常，请重试。"); }) as T & { error?: string; message?: string };
    if (!response.ok) throw new Error(payload.message || payload.error || "操作失败，请重试。");
    return payload;
  } catch (caught) {
    if (caught instanceof Error && ["AbortError", "TimeoutError"].includes(caught.name)) throw new Error("请求超时，请重试。");
    if (caught instanceof TypeError) throw new Error("网络异常，请重试。");
    throw caught;
  }
}
