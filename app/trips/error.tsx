"use client";

export default function TripsError({ reset }: { reset: () => void }) {
  return <main className="archive-index"><header><span>TRIPS</span><h1>攻略</h1></header><div className="trip-empty"><h2>行程读取失败</h2><p>数据没有被删除，请稍后再试。</p><button onClick={reset}>重新加载</button></div></main>;
}
