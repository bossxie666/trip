/* eslint-disable @next/next/no-html-link-for-pages */
import { cities } from "@/data/cities";

export default function CitiesPage() {
  return <main className="archive-placeholder"><a href="/">返回首页</a><h1>城市影集</h1><p>影集架构已预留。</p><ul>{cities.map((city) => <li key={city.id}><a href={`/cities/${city.slug}`}>{city.name}</a></li>)}</ul></main>;
}
