"use client";
import Link from "next/link";
import { RecoveryHeader } from "@/components/site/RecoveryHeader";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <><RecoveryHeader /><main className="system-state-page"><section className="system-state-card" role="alert"><h1>页面暂时没有打开</h1><div><button type="button" onClick={reset}>重新加载</button><Link href="/">返回首页</Link></div></section></main></>;
}
