import Link from "next/link";

export default function TripNotFound() {
  return <main className="archive-placeholder"><Link href="/trips">返回攻略中心</Link><h1>没有找到这条行程</h1><p>它可能尚未创建、地址有误，或者已经被移除。</p></main>;
}
