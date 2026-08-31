"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NewTripForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"inspiration" | "planning">("planning");
  const [cities, setCities] = useState([""]);
  const [undated, setUndated] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [people, setPeople] = useState(1);
  const [cover, setCover] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateCity(index: number, value: string) {
    setCities((current) => current.map((city, cityIndex) => cityIndex === index ? value : city));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, status, cities, undated, startDate, endDate, people, cover }),
      });
      const payload = await response.json() as { trip?: { slug: string }; error?: string };
      if (!response.ok || !payload.trip) throw new Error(payload.error || "创建失败，请重试。");
      router.push(`/trips/${payload.trip.slug}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败，请重试。");
      setSaving(false);
    }
  }

  return (
    <form className="new-trip-form" onSubmit={submit}>
      <label><span>行程名称 *</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：日本关西" /></label>
      <fieldset><legend>状态</legend><label><input type="radio" checked={status === "planning"} onChange={() => setStatus("planning")} />待出行</label><label><input type="radio" checked={status === "inspiration"} onChange={() => setStatus("inspiration")} />灵感</label></fieldset>
      <fieldset className="city-fields"><legend>目的地 / 城市 *</legend>{cities.map((city, index) => <div key={index}><input required value={city} onChange={(event) => updateCity(index, event.target.value)} placeholder={index ? "继续添加城市" : "例如：大阪"}/>{cities.length > 1 && <button type="button" onClick={() => setCities((current) => current.filter((_, cityIndex) => cityIndex !== index))}>移除</button>}</div>)}<button type="button" onClick={() => setCities((current) => [...current, ""])}>＋ 添加城市</button></fieldset>
      <fieldset><legend>日期</legend><label className="inline-check"><input type="checkbox" checked={undated} onChange={(event) => setUndated(event.target.checked)} />日期未定</label><div className="date-fields"><label><span>开始日期</span><input type="date" required={!undated} disabled={undated} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>结束日期</span><input type="date" required={!undated} disabled={undated} min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div></fieldset>
      <label><span>人数</span><input type="number" min="1" step="1" value={people} onChange={(event) => setPeople(Math.max(1, Number(event.target.value) || 1))} /></label>
      <label><span>封面地址（预留，可不填）</span><input value={cover} onChange={(event) => setCover(event.target.value)} placeholder="本阶段不提供照片上传" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="create-trip-button" type="submit" disabled={saving}>{saving ? "正在保存…" : "创建行程"}</button>
    </form>
  );
}
