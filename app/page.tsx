/* eslint-disable @next/next/no-html-link-for-pages */
import { LegacyTripRedirect } from "@/components/layout/LegacyTripRedirect";

export default function TravelArchiveHome() {
  return (
    <main className="archive-home">
      <LegacyTripRedirect />
      <p>TRAVEL ARCHIVE</p>
      <h1>跳进地理书的旅行</h1>
      <a href="/trips">进入攻略</a>
    </main>
  );
}
