export type ApiErrorBody = { code: string; message: string; requestId: string; fieldErrors?: Record<string, string> };

export function hasValidRequestOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  try { return !origin || new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

export function apiError(request: Request, status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
  const requestId = requestIdFrom(request);
  const body: ApiErrorBody = { code, message, requestId, ...(fieldErrors ? { fieldErrors } : {}) };
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-request-id": requestId } });
}
