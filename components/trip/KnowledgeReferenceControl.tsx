"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceNavLink } from "./WorkspaceNavLink";

export function KnowledgeReferenceControl({ slug, itemId, entry }: { slug: string; itemId: string; entry: { id: string; title: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function detach() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/knowledge-items`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId }) });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message || "解除关联失败。");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "解除关联失败。"); }
    finally { setBusy(false); }
  }
  return <div className="knowledge-item-source"><WorkspaceNavLink href={`/knowledge/${encodeURIComponent(entry.id)}`}>查看知识：{entry.title}</WorkspaceNavLink><button type="button" disabled={busy} onClick={() => void detach()}>{busy ? "处理中…" : "解除来源关联"}</button>{error && <small role="alert">{error}</small>}</div>;
}
