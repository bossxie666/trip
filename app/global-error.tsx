"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="zh-CN"><body><main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#f7f1e6",color:"#103e68",fontFamily:"system-ui,sans-serif"}}><section role="alert" style={{width:"min(440px,100%)",padding:28,borderRadius:18,background:"#fffdf7",boxShadow:"0 14px 40px #173a5722",textAlign:"center"}}><h1>网站暂时无法显示</h1><p>请重新加载；如果仍然失败，可以先返回浏览器上一页。</p><button type="button" onClick={reset} style={{minHeight:44,padding:"0 22px",border:0,borderRadius:10,background:"#103e68",color:"white",fontWeight:700}}>重新加载</button></section></main></body></html>;
}
