import Link from "next/link";
export default function NotFound() { return <main className="system-state-page"><section className="system-state-card"><h1>没有找到这个页面</h1><p>链接可能已经变更，或者内容已被移除。</p><div><Link href="/">返回首页</Link><Link href="/trips">查看我的旅行</Link></div></section></main>; }
