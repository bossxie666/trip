import { RegisterForm } from "@/components/auth/RegisterForm";
import { safeInternalReturnTo } from "@/services/return-to";

export const dynamic = "force-dynamic";
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeInternalReturnTo((await searchParams).returnTo);
  return <main className="unlock-page"><section><span>JOIN OUR TRAVEL SPACE</span><h1>加入旅行空间</h1><p>和朋友一起记录旅途。使用管理员提供的邀请码，创建你的个人账号，注册后即可进入旅行空间。</p><RegisterForm returnTo={returnTo} /></section></main>;
}
