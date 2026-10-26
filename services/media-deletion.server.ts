/** Storage removal is an idempotent outbox: D1 commits the intent with the
 * photo removal; R2 failures retain that intent for the scheduled retry. */
export async function drainMediaDeletionQueue(env: { DB: D1Database; MEDIA?: Pick<R2Bucket, "delete"> }, options: { now?: Date; limit?: number } = {}) {
  if (!env.MEDIA) return { deleted: 0, failed: 0 };
  const now = options.now || new Date();
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit || 100)));
  // A restored/live metadata row always wins over an old cleanup intent.
  const rows = (await env.DB.prepare("SELECT q.object_key,q.attempts FROM media_deletion_queue q LEFT JOIN media_assets m ON m.object_key=q.object_key WHERE q.next_attempt_at<=? AND m.id IS NULL ORDER BY q.created_at,q.object_key LIMIT ?").bind(now.toISOString(), limit).all<{ object_key: string; attempts: number }>()).results || [];
  if (!rows.length) return { deleted: 0, failed: 0 };
  try {
    await env.MEDIA.delete(rows.map((row) => row.object_key));
  } catch {
    const statements: D1PreparedStatement[] = [];
    for (let offset = 0; offset < rows.length; offset += 25) {
      const group = rows.slice(offset, offset + 25);
      const delays = group.flatMap((row) => {
        const delay = Math.min(24 * 60 * 60 * 1000, 60000 * 2 ** Math.min(row.attempts, 11));
        return [row.object_key, new Date(now.getTime() + delay).toISOString()];
      });
      statements.push(env.DB.prepare(`UPDATE media_deletion_queue SET attempts=attempts+1,next_attempt_at=CASE object_key ${group.map(() => "WHEN ? THEN ?").join(" ")} ELSE next_attempt_at END,last_error_code='R2_DELETE_FAILED' WHERE object_key IN (${group.map(() => "?").join(",")})`)
        .bind(...delays, ...group.map((row) => row.object_key)));
    }
    await env.DB.batch(statements);
    return { deleted: 0, failed: rows.length };
  }
  // If acknowledgment fails after R2 succeeded, the next run repeats a safe
  // deletion of the same key. Never discard the intent before storage succeeds.
  const acknowledgments: D1PreparedStatement[] = [];
  for (let offset = 0; offset < rows.length; offset += 80) {
    const group = rows.slice(offset, offset + 80);
    acknowledgments.push(env.DB.prepare(`DELETE FROM media_deletion_queue WHERE object_key IN (${group.map(() => "?").join(",")})`).bind(...group.map((row) => row.object_key)));
  }
  await env.DB.batch(acknowledgments);
  return { deleted: rows.length, failed: 0 };
}
