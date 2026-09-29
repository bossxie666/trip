import { getRuntimeEnv } from "@/db";

export async function recordAuditEvent(input: { memberId?: string | null; action: string; resourceType: string; resourceId?: string | null; requestId: string; metadata?: Record<string, string | number | boolean | null> }) {
  try {
    await getRuntimeEnv().DB.prepare("INSERT INTO audit_events (id, member_id, action, resource_type, resource_id, request_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), input.memberId || null, input.action.slice(0, 80), input.resourceType.slice(0, 80), input.resourceId?.slice(0, 160) || null, input.requestId.slice(0, 100), input.metadata ? JSON.stringify(input.metadata) : null, new Date().toISOString()).run();
  } catch { /* audit table is additive; legacy deployments continue safely */ }
}
