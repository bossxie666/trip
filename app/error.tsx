"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="system-state-page"><section className="system-state-card" role="alert"><h1>页面暂时没有打开</h1><p>可以重新加载当前内容，已填写的信息不会自动提交。</p><div><button type="button" onClick={reset}>重新加载</button><Link href="/">返回首页</Link></div></section></main>;
}
