"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

export default function HomeV4Error({ reset }: { reset: () => void }) {
  return <main className="archive-placeholder"><h1>手帐暂时未能打开</h1><p>页面连接中断，请重试。你的行程和照片不会因此改变。</p><button type="button" onClick={reset}>重新打开首页</button><a href="/trips">前往我的旅行</a></main>;
}
