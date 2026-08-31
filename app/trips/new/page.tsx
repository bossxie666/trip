import Link from "next/link";
import { NewTripForm } from "@/components/trip/NewTripForm";

export default function NewTripPage() {
  return <main className="new-trip-page"><nav><Link href="/trips">返回攻略中心</Link></nav><header><span>NEW TRIP</span><h1>新建行程</h1><p>先保存最必要的信息，之后再慢慢补充。</p></header><NewTripForm /></main>;
}
