import Link from "next/link";
import { LegacyTripRedirect } from "@/components/layout/LegacyTripRedirect";

export default function TravelArchiveHome() {
  return (
    <main className="archive-home">
      <LegacyTripRedirect />
      <p>TRAVEL ARCHIVE</p>
      <h1>跳进地理书的旅行</h1>
      <Link href="/trips">进入攻略</Link>
    </main>
  );
}
