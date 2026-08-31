import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const testGlobal = globalThis as typeof globalThis & { __TRIP_TEST_D1__?: D1Database; __TRIP_TEST_ENV__?: Record<string, string> };
const runtimeEnv = testGlobal.__TRIP_TEST_D1__ ? { DB: testGlobal.__TRIP_TEST_D1__, ...testGlobal.__TRIP_TEST_ENV__ } : (await import("cloudflare:workers")).env;

export function getRuntimeEnv() {
  return runtimeEnv as typeof runtimeEnv & {
    TRIP_SPACE_INVITE_CODE?: string;
    TRIP_SPACE_SESSION_SECRET?: string;
    AMAP_JS_API_KEY?: string;
    AMAP_JS_SECURITY_CODE?: string;
    AMAP_WEB_SERVICE_KEY?: string;
  };
}

export function getDb() {
  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(runtimeEnv.DB, { schema });
}
