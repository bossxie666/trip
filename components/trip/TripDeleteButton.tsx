"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TripDeleteButtonProps = {
  slug: string;
  title: string;
  protected?: boolean;
};

/**
 * List-level delete control for ordinary trips.
 * Protected trips deliberately do not render this affordance; the API also
 * enforces the same guard so a manually crafted request cannot remove them.
 */
export function TripDeleteButton({ slug, title, protected: isProtected = false }: TripDeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (isProtected) return null;

  async function remove() {
    if (!window.confirm(`确定删除“${title}”吗？删除后不能恢复。`)) return;

    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}`, { method: "DELETE" });
      let payload: { error?: string } = {};
      try {
        payload = await response.json() as { error?: string };
      } catch {
        // Keep the user-facing message useful even if the server returned a
        // non-JSON error page.
      }
      if (!response.ok) {
        setError(payload.error || "删除失败，请重试。");
        setDeleting(false);
        return;
      }
      router.replace("/trips");
      router.refresh();
    } catch {
      setError("删除失败，请检查网络后重试。");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="trip-delete-button"
        data-trip-slug={slug}
        aria-label={`删除行程：${title}`}
        disabled={deleting}
        onClick={() => void remove()}
      >
        {deleting ? "删除中…" : "删除行程"}
      </button>
      {error && <span className="trip-delete-error" role="alert">{error}</span>}
    </>
  );
}
