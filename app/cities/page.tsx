import Link from "next/link";
import { cities } from "@/data/cities";

export default function CitiesPage() {
  return <main className="archive-placeholder"><Link href="/">返回首页</Link><h1>城市影集</h1><p>影集架构已预留。</p><ul>{cities.map((city) => <li key={city.id}><Link href={`/cities/${city.slug}`}>{city.name}</Link></li>)}</ul></main>;
}
