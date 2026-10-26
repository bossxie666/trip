"use client";
import { useEffect, useState } from "react";
import { BookOpenText, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkspaceOverlay } from "./WorkspaceOverlay";
type Entry = { id: string; title: string; summary: string | null; destination: string | null; tags: string[]; places: { id: string; name: string; address: string | null }[] };
export function KnowledgeTripPicker({ slug, days, defaultDayId }: { slug: string; days: { id: string; label: string }[]; defaultDayId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [entries, setEntries] = useState<Entry[]>([]), [query, setQuery] = useState(""), [destination, setDestination] = useState(""), [tag, setTag] = useState("");
  const [dayId, setDayId] = useState(defaultDayId), [saving, setSaving] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false), [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false);
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  function endpoint(targetPage: number) { const params = new URLSearchParams({ section: "travel_guide", q: query, destination, tag, page: String(targetPage) }); return `/api/knowledge?${params}`; }
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/knowledge?${new URLSearchParams({ section: "travel_guide", q: query, destination, tag })}`, { signal: controller.signal });
        const payload = await response.json() as { entries?: Entry[]; hasMore?: boolean; message?: string };
        if (!response.ok) throw new Error(payload.message || "知识库读取失败。");
        setEntries(payload.entries || []); setHasMore(!!payload.hasMore); setPage(1); setError("");
      } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "知识库读取失败。"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query, destination, tag]);
  async function more() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(endpoint(page + 1));
      const payload = await response.json() as { entries?: Entry[]; hasMore?: boolean; message?: string };
      if (!response.ok) throw new Error(payload.message || "知识库读取失败。");
      setEntries(current => [...new Map([...current, ...(payload.entries || [])].map(entry => [entry.id, entry])).values()]);
      setHasMore(!!payload.hasMore); setPage(current => current + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "知识库读取失败。"); }
    finally { setLoading(false); }
  }
  async function add(entry: Entry) {
    if (saving || loading) return;
    setSaving(entry.id); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/knowledge-items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId: entry.id, dayId, placeIds: choices[entry.id] ?? entry.places.map(place => place.id) }) });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.message || payload.error || "添加失败。");
      setOpen(false); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "添加失败。"); }
    finally { setSaving(""); }
  }
  return <><button className="knowledge-picker-trigger" type="button" onClick={() => { setDayId(defaultDayId); setLoading(true); setOpen(true); }}><BookOpenText size={19} />从知识库添加</button>
    <WorkspaceOverlay open={open} onClose={() => !saving && setOpen(false)} ariaLabel="从知识库添加" className="knowledge-picker-dialog clean-dialog">
      <header className="editor-dialog-heading"><h2>从知识库添加</h2><button type="button" disabled={!!saving} aria-label="关闭" onClick={() => setOpen(false)}><X size={20} /></button></header>
      <div className="knowledge-picker-filters"><input aria-label="搜索知识" value={query} onChange={event => { setLoading(true); setQuery(event.target.value); }} placeholder="搜索攻略或标签" /><input aria-label="目的地" value={destination} onChange={event => { setLoading(true); setDestination(event.target.value); }} placeholder="目的地" /><input aria-label="标签筛选" value={tag} onChange={event => { setLoading(true); setTag(event.target.value); }} placeholder="标签" /><select aria-label="目标日期" value={dayId} onChange={event => setDayId(event.target.value)}>{days.map(day => <option key={day.id} value={day.id}>{day.label}</option>)}</select></div>
      <div className="knowledge-picker-list" aria-busy={loading}>{entries.map(entry => {
        const selected = choices[entry.id] ?? entry.places.map(place => place.id);
        return <article key={entry.id}><div><b>{entry.title}</b>{entry.destination && <p>{entry.destination}</p>}<small>{entry.tags.map(tag => `#${tag}`).join(" ")}</small>
          {entry.places.length > 0 && <fieldset className="knowledge-picker-places"><legend>选择加入的地点</legend>{entry.places.map(place => <label key={place.id}><input type="checkbox" checked={selected.includes(place.id)} disabled={!!saving || loading} onChange={event => setChoices(current => ({ ...current, [entry.id]: event.target.checked ? [...selected, place.id] : selected.filter(id => id !== place.id) }))} /><span>{place.name}<small>{place.address}</small></span></label>)}{!selected.length && <small>将仅添加攻略事项。</small>}</fieldset>}
        </div><button type="button" disabled={!!saving || loading} onClick={() => add(entry)}><Plus size={17} />{saving === entry.id ? "添加中" : "添加"}</button></article>;
      })}{!entries.length && !loading && <p className="plan-empty">暂无匹配攻略</p>}{loading && <p role="status">读取中…</p>}{hasMore && <button type="button" disabled={loading} onClick={more}>加载更多</button>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </WorkspaceOverlay>
  </>;
}