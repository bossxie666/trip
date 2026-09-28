export type ApiErrorBody = { code: string; message: string; requestId: string; fieldErrors?: Record<string, string> };

export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

export function apiError(request: Request, status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
  const requestId = requestIdFrom(request);
  const body: ApiErrorBody = { code, message, requestId, ...(fieldErrors ? { fieldErrors } : {}) };
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-request-id": requestId } });
}
