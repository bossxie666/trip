import { AsyncLocalStorage } from "node:async_hooks";

type VerifiedSession = { token: string | undefined; database: D1Database; memberId: string; stats?: { reuses: number } };
const verifiedSession = new AsyncLocalStorage<VerifiedSession>();

/** Only the Worker may seed this context, after checking the revocable session.
 * It lives in async request scope, never in a shared member cache or HTTP header. */
export function runWithVerifiedSession<T>(session: VerifiedSession, run: () => T): T {
  return verifiedSession.run(session, run);
}

export function verifiedRequestMemberId(token: string | undefined, database: D1Database | undefined): string | undefined {
  const session = verifiedSession.getStore();
  if (!session || session.token !== token || session.database !== database) return undefined;
  if (session.stats) session.stats.reuses += 1;
  return session.memberId;
}
