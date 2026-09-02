/* eslint-disable @next/next/no-html-link-for-pages */
import { MemberIdentityControl } from "@/components/auth/MemberIdentityControl";
import { getCurrentMember } from "@/services/auth.server";

export default async function TravelArchiveHome() {
  const current = await getCurrentMember();
  return (
    <main className="archive-home">
      <div className="archive-home-topbar"><MemberIdentityControl currentMember={current ? { id: current.id, displayName: current.displayName } : null} /></div>
      <p>TRAVEL ARCHIVE</p>
      <h1>跳进地理书的旅行</h1>
      <a href="/trips">进入攻略</a>
    </main>
  );
}
