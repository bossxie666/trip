"use client";
import Link from "next/link";
import { RecoveryHeader } from "@/components/site/RecoveryHeader";

export default function TripsError({ reset }: { reset: () => void }) {
  return <><RecoveryHeader active="trips" /><main className="system-state-page"><section className="system-state-card" role="alert"><h1>行程读取失败</h1><div><button type="button" onClick={reset}>重新加载</button><Link href="/trips">我的旅行</Link><Link href="/">返回首页</Link></div></section></main></>;
}
