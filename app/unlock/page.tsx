import { UnlockForm } from "@/components/auth/UnlockForm";
import { safeInternalReturnTo } from "@/services/return-to";

export const dynamic = "force-dynamic";
export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeInternalReturnTo((await searchParams).returnTo);
  return <main className="unlock-page"><section><span>PRIVATE TRAVEL SPACE</span><h1>旅行成员入口</h1><p>输入你登记的名字，再输入大家共用的旅行空间暗号。</p><UnlockForm returnTo={returnTo} /></section></main>;
}
