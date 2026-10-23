interface D1Result<T = unknown> { success: boolean; results: T[]; meta?: Record<string, unknown> }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec?(query: string): Promise<unknown>;
}
interface R2ObjectBody { body: ReadableStream; size: number; writeHttpMetadata(headers: Headers): void }
interface R2Object { size: number }
interface R2Bucket { put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, options?: unknown): Promise<unknown>; get(key: string): Promise<R2ObjectBody | null>; head(key: string): Promise<R2Object | null>; delete(key: string | string[]): Promise<void> }
interface Fetcher { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }

declare module "cloudflare:workers" {
  export const env: { DB: D1Database; IMAGES: { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } } }; [key: string]: unknown };
}
