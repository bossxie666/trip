import Link from "next/link";
import { RecoveryHeader } from "@/components/site/RecoveryHeader";
export default function NotFound() { return <><RecoveryHeader /><main className="system-state-page"><section className="system-state-card"><h1>没有找到这个页面</h1><div><Link href="/">返回首页</Link><Link href="/trips">我的旅行</Link></div></section></main></>; }
