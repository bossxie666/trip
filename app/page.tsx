import Link from "next/link";

export default function TravelArchiveHome() {
  return (
    <main className="archive-home">
      <p>TRAVEL ARCHIVE</p>
      <h1>跳进地理书的旅行</h1>
      <Link href="/trips">进入攻略</Link>
    </main>
  );
}
