/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";

type Train = { id: string; no: string; leave: string; arrive: string; fare: number; duration: string; metro: boolean; note?: string };
const airportOptions = [
  { id: "link", name: "机场联络线＋接驳", total: 18, time: "约 55–70 分", note: "两人合计按 ¥18 估算；实际接驳以当日为准" },
  { id: "metro", name: "全程地铁", total: 14, time: "约 80–95 分", note: "低价底线；拖行李、换乘更累" },
  { id: "taxi", name: "网约车 / 出租车", total: 105, time: "约 30–45 分", note: "按 ¥90–120/车中位数估；只由落地两人平分" },
];
const hotelZones = [
  { id: "south", name: "上海南站", tag: "第二天赶车最稳", nightMetro: 28, nightTaxi: 130, nightTime: "82 / 58 分", nightRoute: "11号线：迪士尼→徐家汇；换1号线→上海南站", dayTransit: 20, dayTime: "45 分", dayRoute: "1号线：上海南站→人民广场；换2号线→陆家嘴", toTrain: 20, toTrainTime: "52 分" },
  { id: "xujiahui", name: "徐家汇", tag: "通勤最均衡", nightMetro: 28, nightTaxi: 115, nightTime: "68 / 50 分", nightRoute: "11号线：迪士尼→徐家汇，直达不换乘", dayTransit: 16, dayTime: "36 分", dayRoute: "1号线：徐家汇→人民广场；换2号线→陆家嘴", toTrain: 12, toTrainTime: "50 分" },
  { id: "bund", name: "外滩周边", tag: "夜景方便、房价偏高", nightMetro: 24, nightTaxi: 108, nightTime: "75 / 48 分", nightRoute: "11号线：迪士尼→江苏路；换2号线→南京东路", dayTransit: 12, dayTime: "22 分", dayRoute: "2号线：南京东路→陆家嘴，1站", toTrain: 20, toTrainTime: "40 分" },
  { id: "luz", name: "陆家嘴", tag: "东方明珠就在楼下", nightMetro: 24, nightTaxi: 92, nightTime: "64 / 42 分", nightRoute: "11号线：迪士尼→江苏路；换2号线→陆家嘴", dayTransit: 0, dayTime: "步行 10 分", dayRoute: "步行：酒店→东方明珠外观位", toTrain: 24, toTrainTime: "60 分" },
  { id: "disney", name: "迪士尼周边", tag: "散场最快、第二天最远", nightMetro: 0, nightTaxi: 32, nightTime: "接驳 22 / 18 分", nightRoute: "酒店免费接驳 / 步行，以酒店班次为准", dayTransit: 24, dayTime: "62 分", dayRoute: "11号线→罗山路；换16号线→龙阳路；换2号线→陆家嘴", toTrain: 20, toTrainTime: "45 分＋寄存" },
];
const luggageOptions = [
  { id: "third", name: "第三方寄存点", total: 50, note: "按 3 背包＋1 行李箱估；先查营业时间和过夜规则" },
  { id: "station", name: "上海南站寄存", total: 48, note: "适合住南站 / 徐家汇；确认最晚取件时间" },
  { id: "hotel", name: "酒店免费寄存", total: 0, note: "最省钱，但要先向酒店确认可寄存到晚上" },
  { id: "official", name: "园区官方寄存", total: 110, note: "只作兜底，预算路线不优先" },
];
const riverOptions = [
  { id: "ferry", name: "轮渡过江", total: 8, time: "约 28 分", note: "4 人合计约 ¥8，顺便看江景" },
  { id: "metro", name: "地铁过江", total: 12, time: "约 18 分", note: "下雨或赶时间更稳定" },
];
const eastTrains: Train[] = [
  { id: "g7527", no: "G7527", leave: "20:21", arrive: "21:15", fare: 86, duration: "54 分", metro: true },
  { id: "g7529", no: "G7529", leave: "20:32", arrive: "21:40", fare: 86, duration: "1 小时 08 分", metro: true },
  { id: "g7551e", no: "G7551", leave: "20:40", arrive: "21:35", fare: 86, duration: "55 分", metro: true },
  { id: "g7553", no: "G7553", leave: "21:09", arrive: "22:04", fare: 86, duration: "55 分", metro: true, note: "推荐：外滩留时更足，仍有地铁余量" },
  { id: "c2349", no: "C2349", leave: "22:00", arrive: "22:46", fare: 77, duration: "46 分", metro: true, note: "能赶地铁，但理论余量仅约 33 分" },
];
const southTrains: Train[] = [
  { id: "d57", no: "D57", leave: "19:40", arrive: "21:32", fare: 39, duration: "1 小时 52 分", metro: true, note: "推荐省钱：到站后可接 5 号线" },
  { id: "d107", no: "D107", leave: "20:38", arrive: "22:27", fare: 36, duration: "1 小时 49 分", metro: false, note: "到站太贴近末班，按打车计算" },
  { id: "g7551s", no: "G7551", leave: "20:40", arrive: "21:51", fare: 97, duration: "1 小时 11 分", metro: true, note: "可赶地铁，但车票比杭州东还贵" },
  { id: "d81", no: "D81", leave: "20:44", arrive: "22:40", fare: 36, duration: "1 小时 56 分", metro: false, note: "错过地铁，需打车到杭州站" },
];
const hotelCards = [
  { name: "上海南站 / 徐家汇经济连锁", zone: "south", price: "¥280–450", why: "第二天取行李、去上海南站最稳", risk: "迪士尼散场后通勤长" },
  { name: "如家 · 秀沿路地铁站一带", zone: "disney", price: "¥300–380", why: "11 号线通勤明确，散场压力小", risk: "第二天进市区约 1 小时" },
  { name: "里外里假日酒店一类接驳酒店", zone: "disney", price: "¥280–420", why: "常见免费班车，适合四人", risk: "接驳班次必须逐家确认" },
  { name: "客莱福诺富特 / 康新公路周边", zone: "disney", price: "¥400–650", why: "地铁＋班车双保险", risk: "9 月 23 日可能超过 ¥500" },
  { name: "外滩外围经济酒店", zone: "bund", price: "¥380–500+", why: "第二天步行看外滩省时间", risk: "同价房可能小、离地铁远" },
  { name: "陆家嘴外围经济酒店", zone: "luz", price: "¥350–500+", why: "早晨直接去东方明珠外观位", risk: "去上海南站最远" },
];
const disneyRoutes = [
  { id: "balanced", name: "均衡少走路", color: "#bd684d", path: ["入园", "飞越地平线", "加勒比海盗", "疯狂动物城", "七个小矮人矿山车", "花车 / 补项目", "城堡烟花"], tip: "按地图顺时针走；排队超过 80 分钟先跳过，下午再回补。" },
  { id: "thrill", name: "刺激项目优先", color: "#4f7881", path: ["入园", "创极速光轮", "抱抱龙冲天赛车", "七个小矮人矿山车", "飞越地平线", "加勒比海盗", "烟花"], tip: "开园先冲明日世界，减少跨园折返；全是门票内项目。" },
  { id: "relaxed", name: "轻松拍照版", color: "#7e8c6c", path: ["入园", "米奇大街", "奇幻童话城堡", "小熊维尼历险记", "疯狂动物城", "加勒比海盗", "烟花"], tip: "少追项目，多留拍照和吃饭时间，适合落地当天体力不满格。" },
];
const shanghaiPins = [
  { name: "上海南站", lat: 31.154, lon: 121.429 }, { name: "徐家汇", lat: 31.183, lon: 121.437 },
  { name: "外滩", lat: 31.240, lon: 121.490 }, { name: "东方明珠", lat: 31.2397, lon: 121.4998 },
  { name: "迪士尼", lat: 31.1433, lon: 121.6578 }, { name: "浦东 T2", lat: 31.1443, lon: 121.8083 },
];
const hangzhouPins = [
  { name: "杭州站 / 酒店", lat: 30.243482, lon: 120.18286 }, { name: "杭州东站", lat: 30.291, lon: 120.212 },
  { name: "杭州南站", lat: 30.1665, lon: 120.2936 }, { name: "西湖", lat: 30.253, lon: 120.15 },
];
function project(lat: number, lon: number, city: "shanghai" | "hangzhou") {
  const b = city === "shanghai" ? { minLat: 30.98, maxLat: 31.42, minLon: 121.28, maxLon: 121.92 } : { minLat: 30.04, maxLat: 30.36, minLon: 120.02, maxLon: 120.38 };
  return { x: ((lon - b.minLon) / (b.maxLon - b.minLon)) * 100, y: ((b.maxLat - lat) / (b.maxLat - b.minLat)) * 100 };
}
function money(value: number) { return `¥${Number.isInteger(value) ? value : value.toFixed(1)}`; }

export default function Home() {
  const [airport, setAirport] = useState("link"); const [zone, setZone] = useState("south");
  const [night, setNight] = useState<"metro" | "taxi">("metro"); const [luggage, setLuggage] = useState("hotel");
  const [river, setRiver] = useState("ferry"); const [hotelPrice, setHotelPrice] = useState(420); const [meals, setMeals] = useState(120);
  const [arrival, setArrival] = useState<"east" | "south">("east"); const [trainId, setTrainId] = useState("g7553");
  const [hzMode, setHzMode] = useState<"metro" | "taxi">("metro"); const [mapCity, setMapCity] = useState<"shanghai" | "hangzhou">("shanghai");
  const [mapKind, setMapKind] = useState<"detail" | "simple">("detail"); const [disneyRoute, setDisneyRoute] = useState("balanced");
  const [companion, setCompanion] = useState("B"); const [companionTransport, setCompanionTransport] = useState(0);
  const [companionTicket, setCompanionTicket] = useState(366); const [companionMeals, setCompanionMeals] = useState(120);
  const [companionOther, setCompanionOther] = useState(0); const [includeShared, setIncludeShared] = useState(true);
  const selectedAirport = airportOptions.find(x => x.id === airport)!; const selectedZone = hotelZones.find(x => x.id === zone)!;
  const selectedLuggage = luggageOptions.find(x => x.id === luggage)!; const selectedRiver = riverOptions.find(x => x.id === river)!;
  const trains = arrival === "east" ? eastTrains : southTrains; const selectedTrain = trains.find(x => x.id === trainId) ?? trains[0];
  const effectiveHzMode = !selectedTrain.metro ? "taxi" : hzMode;
  const hzFare = arrival === "east" ? (effectiveHzMode === "metro" ? 4 : 7.5) : (effectiveHzMode === "metro" ? 5 : 16.25);
  const nightFare = night === "metro" ? selectedZone.nightMetro : selectedZone.nightTaxi;
  const sharedEach = useMemo(() => hotelPrice / 4 + selectedLuggage.total / 4 + nightFare / 4 + selectedZone.dayTransit / 4 + selectedRiver.total / 4 + selectedZone.toTrain / 4 + selectedTrain.fare + hzFare + meals, [hotelPrice, selectedLuggage, nightFare, selectedZone, selectedRiver, selectedTrain, hzFare, meals]);
  const airportEach = selectedAirport.total / 2;
  const myTotal = sharedEach + 366 + 560 + airportEach;
  const commonShare = sharedEach - meals;
  const companionTotal = companionTransport + companionTicket + companionMeals + companionOther + (includeShared ? commonShare : 0);
  const changeArrival = (next: "east" | "south") => { setArrival(next); setTrainId(next === "east" ? "g7553" : "d57"); setHzMode("metro"); };
  const pins = mapCity === "shanghai" ? shanghaiPins : hangzhouPins; const activeDisney = disneyRoutes.find(x => x.id === disneyRoute)!;
  const airportDetail = airport === "link" ? "机场联络线：浦东1/2航站楼→上海国际旅游度假区；再换园区接驳" : airport === "metro" ? "2号线→龙阳路；换16号线→罗山路；换11号线→迪士尼" : "网约车 / 出租车：浦东 T2→迪士尼，约30–45分钟";
  const nightDetail = night === "metro" ? selectedZone.nightRoute : `打车：迪士尼→${selectedZone.name}，四人约 ${money(selectedZone.nightTaxi)}`;

  return <main>
    <nav className="topbar"><a href="#top" className="wordmark">TRIP ARCHIVE <small>旅行档案馆</small></a><div><a href="#planner">算一算</a><a href="#maps">地图</a><a href="#disney">迪士尼</a><a href="#trains">去杭州</a></div></nav>
    <section className="hero" id="top">
      <div className="hero-copy paper-note"><span className="stamp">TRIP 001 · SEP 23—24 · 2026</span><h1 className="art-title" aria-label="跳进地理书的旅行"><span data-text="跳进地理书">跳进地理书</span><span data-text="的旅行">的旅行</span></h1><p className="hero-route">深圳 → 上海 → 杭州</p><div className="hero-actions"><a className="ink-button" href="#planner">开始做选择</a><a className="text-button" href="#maps">先看地图 ↗</a></div></div>
      <div className="hero-gallery" aria-label="上海杭州旅行画廊"><figure className="gallery-card card-airport"><div className="scene scene-airport"><span>PVG</span></div><figcaption>09:10 · 浦东落地</figcaption></figure><figure className="gallery-card card-disney"><div className="scene scene-disney"><span>DAY 1</span></div><figcaption>上海迪士尼 · 四人会合</figcaption></figure><figure className="gallery-card card-river"><div className="scene scene-river"><span>DAY 2</span></div><figcaption>外滩 ↔ 陆家嘴</figcaption></figure><div className="route-ticket"><b>SZX — SHA — HGH</b><span>2 DAYS · 4 PEOPLE · LOW COST</span></div><i className="tape tape-a"/><i className="tape tape-b"/></div>
      <div className="archive-strip"><article className="archive-active"><span>001</span><b>上海＋杭州</b><small>这一次旅行 · 正在计划</small></article><article><span>002</span><b>下一次旅行</b><small>未完待续 · 留给下一张车票</small></article><article><span>003</span><b>照片墙</b><small>旅行结束后，把照片贴进来</small></article></div>
    </section>

    <section className="planner" id="planner"><header className="section-heading"><span>01 / DECISION DESK</span><h2>你来选，我把后果算出来</h2><p>每次点击都会同时改变路线、时间风险和四个人各自的明细。页面不显示四人总价，只显示每个人要承担多少。</p></header>
      <div className="planner-grid"><div className="controls-panel">
        <Control title="浦东 T2 → 迪士尼（仅 A、B 两人）" value={airport} onChange={setAirport} options={airportOptions.map(x => ({ id: x.id, label: x.name, meta: `${money(x.total)} / 两人 · ${x.time}` }))}/>
        <Control title="第一晚住哪里" value={zone} onChange={setZone} options={hotelZones.map(x => ({ id: x.id, label: x.name, meta: x.tag }))}/>
        <Control title="迪士尼散场 → 酒店" value={night} onChange={v => setNight(v as "metro" | "taxi")} options={[{ id: "metro", label: "地铁 / 酒店接驳", meta: `四人约 ${money(selectedZone.nightMetro)}` }, { id: "taxi", label: "打车", meta: `四人约 ${money(selectedZone.nightTaxi)}` }]}/>
        <Control title="第二天行李放哪里" value={luggage} onChange={setLuggage} options={luggageOptions.map(x => ({ id: x.id, label: x.name, meta: `四人约 ${money(x.total)}` }))}/>
        <Control title="东方明珠 → 外滩怎么过江" value={river} onChange={setRiver} options={riverOptions.map(x => ({ id: x.id, label: x.name, meta: `${money(x.total)} / 四人 · ${x.time}` }))}/>
        <div className="slider-block"><label>上海酒店一晚：<b>{money(hotelPrice)}</b></label><input aria-label="酒店价格" type="range" min="220" max="500" step="10" value={hotelPrice} onChange={e => setHotelPrice(Number(e.target.value))}/><div><span>¥220</span><span>预算上限 ¥500</span></div></div>
        <div className="slider-block"><label>每人吃喝预算：<b>{money(meals)}</b></label><input aria-label="餐饮预算" type="range" min="60" max="240" step="10" value={meals} onChange={e => setMeals(Number(e.target.value))}/><div><span>自带＋简餐</span><span>园区正餐</span></div></div>
      </div><aside className="decision-receipt"><span className="receipt-label">CURRENT CHOICE</span><h3>{selectedZone.name}住宿 · {arrival === "east" ? "杭州东" : "杭州南"}到站</h3><ul><li><span>机场两人组</span><b>{selectedAirport.name} · {selectedAirport.time}</b></li><li><span>散场去酒店</span><b>{night === "metro" ? "公共交通" : "打车"} · {selectedZone.nightTime}</b></li><li><span>东方明珠</span><b>只看外观 · ¥0</b></li><li><span>行李</span><b>{selectedLuggage.name}</b></li><li><span>上海南发车</span><b>{selectedTrain.no} · {selectedTrain.leave}—{selectedTrain.arrive}</b></li></ul><div className="warning-note"><b>别漏掉：</b>{selectedAirport.note}。{selectedLuggage.note}。</div></aside></div>
    </section>

    <section className="people-costs"><header className="section-heading compact"><span>02 / PERSONAL COST</span><h2>我的个人消费</h2><p>只保留我自己的完整明细。同行人的来沪方式和个人消费不同，放到右侧计算器由她们自己填写。</p></header>
      <div className="personal-cost-layout">
        <article className="my-cost-card"><header><div><span>深圳出发 · 机场两人组</span><h3>我的已知费用</h3></div><strong>{money(myTotal)}</strong></header><div className="cost-lines"><CostLine name="深圳→上海机票" amount={560} note="截图确认约 ¥560"/><CostLine name="迪士尼门票" amount={366} note="已购买"/><CostLine name="浦东→迪士尼" amount={airportEach} note="只在机场落地的两人之间平分"/><CostLine name="上海住宿" amount={hotelPrice / 4} note={`总房费 ${money(hotelPrice)} ÷ 4`}/><CostLine name="散场→酒店" amount={nightFare / 4} note="四人平分"/><CostLine name="行李寄存" amount={selectedLuggage.total / 4} note="按四人平分"/><CostLine name="Day 2 市内交通" amount={(selectedZone.dayTransit + selectedRiver.total + selectedZone.toTrain) / 4} note="酒店→陆家嘴＋过江＋上海南"/><CostLine name={`${selectedTrain.no} 火车票`} amount={selectedTrain.fare} note={`${arrival === "east" ? "杭州东" : "杭州南"}到站`}/><CostLine name="杭州到酒店" amount={hzFare} note={`${effectiveHzMode === "metro" ? "地铁" : "打车平分"}到杭州站附近`}/><CostLine name="两天吃喝预留" amount={meals} note="跟随上方滑杆"/></div></article>
        <aside className="companion-calculator"><div className="calculator-head"><div><span>SELF CALCULATOR</span><h3>同行人自助计算</h3></div><strong>{money(companionTotal)}</strong></div><div className="companion-tabs">{["B","C","D"].map(name => <button key={name} className={companion === name ? "active" : ""} onClick={() => setCompanion(name)}>同行人 {name}</button>)}</div><EditableCost label="来沪交通" value={companionTransport} setValue={setCompanionTransport} max={1200}/><EditableCost label="迪士尼门票" value={companionTicket} setValue={setCompanionTicket} max={800}/><EditableCost label="个人吃喝" value={companionMeals} setValue={setCompanionMeals} max={400}/><EditableCost label="其他消费" value={companionOther} setValue={setCompanionOther} max={1000}/><label className="shared-toggle"><input type="checkbox" checked={includeShared} onChange={e => setIncludeShared(e.target.checked)}/><span>加入本次共同分摊 <b>{money(commonShare)}</b><small>住宿、散场交通、寄存、Day 2 交通、火车和杭州接驳</small></span></label><p>切换 B/C/D 不会自动猜她们的交通；请由本人拖动滑杆或在数字框直接填写。</p></aside>
      </div><p className="cost-footnote">这里显示的是已知费用，不是支付账单；酒店、打车、寄存和餐饮仍可能变化。</p></section>

    <section className="maps" id="maps"><header className="section-heading"><span>03 / MAP DESK</span><h2>先看真实道路，再看简单方位</h2><p>详细图把道路、铁路、河流和实际坐标放进网页，断网仍能看；它不是实时导航。要看路况时一键交给高德。</p></header><div className="map-toolbar"><div className="segmented"><button className={mapCity === "shanghai" ? "active" : ""} onClick={() => setMapCity("shanghai")}>上海</button><button className={mapCity === "hangzhou" ? "active" : ""} onClick={() => setMapCity("hangzhou")}>杭州</button></div><div className="segmented"><button className={mapKind === "detail" ? "active" : ""} onClick={() => setMapKind("detail")}>详细离线图</button><button className={mapKind === "simple" ? "active" : ""} onClick={() => setMapKind("simple")}>简单方位图</button></div><a className="amap-button" target="_blank" rel="noreferrer" href={mapCity === "shanghai" ? "https://uri.amap.com/search?keyword=上海迪士尼度假区&city=上海&src=trip-archive" : "https://cache.gaode.com/activity/openamap/index.html?schema=amapuri%3A%2F%2Fpoi%2Ftip%3Fpoiname%3D%E6%9D%AD%E5%B7%9E%E7%AB%99%26lat%3D30.243482%26lon%3D120.182860%26poiid%3DB023B07ERI"}>在高德打开 ↗</a></div>
      <div className={`map-frame ${mapKind}`}>{mapKind === "detail" ? <><img src={`/maps/${mapCity}-base.svg`} alt={`${mapCity === "shanghai" ? "上海" : "杭州"}离线道路地图`}/><svg className="route-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{mapCity === "shanghai" ? <><polyline points={`${project(31.1443,121.8083,"shanghai").x},${project(31.1443,121.8083,"shanghai").y} ${project(31.1433,121.6578,"shanghai").x},${project(31.1433,121.6578,"shanghai").y}`}/><polyline className="day-two" points={`${project(31.1433,121.6578,"shanghai").x},${project(31.1433,121.6578,"shanghai").y} ${project(31.2397,121.4998,"shanghai").x},${project(31.2397,121.4998,"shanghai").y} ${project(31.240,121.490,"shanghai").x},${project(31.240,121.490,"shanghai").y} ${project(31.154,121.429,"shanghai").x},${project(31.154,121.429,"shanghai").y}`}/></> : <><polyline points={`${project(30.291,120.212,"hangzhou").x},${project(30.291,120.212,"hangzhou").y} ${project(30.243482,120.18286,"hangzhou").x},${project(30.243482,120.18286,"hangzhou").y}`}/><polyline className="day-two" points={`${project(30.1665,120.2936,"hangzhou").x},${project(30.1665,120.2936,"hangzhou").y} ${project(30.243482,120.18286,"hangzhou").x},${project(30.243482,120.18286,"hangzhou").y}`}/></>}</svg>{pins.map((pin,index) => { const p = project(pin.lat,pin.lon,mapCity); return <button key={pin.name} className="map-pin" style={{left:`${p.x}%`,top:`${p.y}%`}} aria-label={pin.name}><i>{index+1}</i><span>{pin.name}</span></button>; })}</> : <SimpleMap city={mapCity}/>}</div>
      {mapCity === "shanghai" && <div className="metro-detail-grid"><article><span>① 落地进园</span><h3>{airportDetail}</h3><p>{selectedAirport.time} · A、B 各 {money(airportEach)}</p></article><article><span>② 烟花散场</span><h3>{nightDetail}</h3><p>{selectedZone.nightTime} · 每人 {money(nightFare/4)}</p></article><article><span>③ 酒店去陆家嘴</span><h3>{selectedZone.dayRoute}</h3><p>{selectedZone.dayTime} · 每人 {money(selectedZone.dayTransit/4)}</p></article><article><span>④ 外滩去上海南</span><h3>2号线：南京东路→人民广场；换1号线→上海南站</h3><p>约 40–52 分钟 · 每人约 ¥5</p></article></div>}
      <div className="map-legend">{mapCity === "shanghai" ? <><article><b>1</b><span>浦东 T2 → 迪士尼</span><strong>{selectedAirport.name} · {selectedAirport.time} · A/B 各 {money(airportEach)}</strong></article><article><b>2</b><span>迪士尼 → {selectedZone.name}</span><strong>{night === "metro" ? "公共交通" : "打车"} · {selectedZone.nightTime} · 每人 {money(nightFare/4)}</strong></article><article><b>3</b><span>Day 2 → 东方明珠外观 → 外滩 → 上海南</span><strong>不上塔 · 门票 ¥0 · 市内交通每人 {money((selectedZone.dayTransit+selectedRiver.total+selectedZone.toTrain)/4)}</strong></article></> : <><article><b>A</b><span>杭州东 → 杭州站酒店</span><strong>1 号线 8 站 · 约 20–22 分 · ¥4/人 · 末班约 23:19</strong></article><article><b>B</b><span>杭州南 → 杭州站酒店</span><strong>5 号线 13 站 · 约 34 分 · ¥5/人 · 末班约 22:35–22:36</strong></article><article><b>!</b><span>酒店只确定“杭州站附近”</span><strong>最后步行分钟数待具体酒店名</strong></article></>}</div>
    </section>

    <section className="disney" id="disney"><header className="section-heading"><span>04 / SHANGHAI DISNEYLAND</span><h2>用官方全景图走，不靠想象</h2><p>路线以上海迪士尼官方园区布局和项目分区为底，所有游玩选择都只使用门票已包含的内容。</p></header><div className="disney-layout"><div className="official-map-wrap"><img src="/maps/disney-official-map.jpg" alt="上海迪士尼乐园官方全景地图"/></div><div className="disney-plan"><div className="route-tabs">{disneyRoutes.map(route => <button key={route.id} className={disneyRoute === route.id ? "active" : ""} onClick={() => setDisneyRoute(route.id)}>{route.name}</button>)}</div><ol style={{"--route-color":activeDisney.color} as React.CSSProperties}>{activeDisney.path.map((stop,index) => <li key={stop}><i>{index+1}</i><span>{stop}</span></li>)}</ol><div className="strategy-note"><b>现场规则：</b>{activeDisney.tip}</div><ul className="plain-checks"><li>09:10 落地不等于 09:10 出机场：留 30–45 分钟下机、洗手间和取行李。</li><li>烟花结束后四人先在固定地标会合，再决定地铁或打车。</li><li>单人通道若当日开放可用，它是免费排队方式；以现场为准。</li><li>排队、项目临时关闭和天气都可能改写顺序。</li></ul><a className="source-link" href="https://www.shanghaidisneyresort.com/zh-cn/experience?group=attraction" target="_blank" rel="noreferrer">查看上海迪士尼官方项目页 ↗</a></div></div></section>

    <section className="daytwo"><header className="section-heading compact"><span>05 / DAY 2</span><h2>外滩与陆家嘴</h2></header><div className="timeline"><article><time>08:30</time><div><h3>退房＋寄存</h3><p>{selectedLuggage.name}。先确认晚上最晚取件时间。</p></div><strong>{money(selectedLuggage.total/4)}/人</strong></article><article><time>10:00</time><div><h3>东方明珠外观位</h3><p>陆家嘴环形天桥 / 滨江步道拍照，停留约 20–30 分钟。</p></div><strong>¥0</strong></article><article><time>11:00</time><div><h3>{selectedRiver.name}去外滩</h3><p>沿万国建筑博览群向南走，需要歇脚就到南京东路补给。</p></div><strong>{money(selectedRiver.total/4)}/人</strong></article><article><time>{selectedTrain.leave}</time><div><h3>上海南 → {arrival === "east" ? "杭州东" : "杭州南"}</h3><p>建议最晚提前 45–60 分钟从外滩出发，预留安检和找检票口时间。</p></div><strong>{money(selectedTrain.fare)}/人</strong></article></div></section>

    <section className="trains" id="trains"><header className="section-heading"><span>06 / LAST LEG</span><h2>杭州东与杭州南，两套方案都保留</h2><p>截图日期是 9 月 13 日，只能作同星期时刻/票价参考。实际乘车是 9 月 24 日，进入预售后要在 12306 再锁定。</p></header><div className="arrival-switch"><button className={arrival === "east" ? "active" : ""} onClick={() => changeArrival("east")}><b>方案 A · 杭州东</b><span>接城站更稳，地铁末班更晚</span></button><button className={arrival === "south" ? "active" : ""} onClick={() => changeArrival("south")}><b>方案 B · 杭州南</b><span>有 ¥36–39 低价票，但晚车会错过地铁</span></button></div><div className="train-layout"><div className="train-list">{trains.map(train => <button key={train.id} className={selectedTrain.id === train.id ? "selected" : ""} onClick={() => setTrainId(train.id)}><div><span>{train.no}</span><b>{train.leave}</b><i>上海南</i></div><em>{train.duration}<small>→</small></em><div><strong>{money(train.fare)}</strong><b>{train.arrive}</b><i>{arrival === "east" ? "杭州东" : "杭州南"}</i></div><p className={train.metro ? "safe" : "risk"}>{train.metro ? "可接地铁" : "需按打车准备"}{train.note ? ` · ${train.note}` : ""}</p></button>)}</div><aside className="hangzhou-transfer"><div className="hangzhou-mini-map"><img src="/maps/hangzhou-base.svg" alt="杭州东站、杭州南站与杭州站方位图"/><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1={arrival === "east" ? 53.3 : 76} y1={arrival === "east" ? 21.6 : 60.5} x2="45.2" y2="36.4"/></svg><i className={`mini-pin east ${arrival === "east" ? "active" : ""}`}>杭州东</i><i className={`mini-pin south ${arrival === "south" ? "active" : ""}`}>杭州南</i><i className="mini-pin hotel">杭州站·酒店</i><i className="mini-pin lake">西湖</i></div><span>到站后 → 杭州站酒店</span><h3>{arrival === "east" ? "1 号线直达城站" : "5 号线直达城站"}</h3><p>{arrival === "east" ? "杭州东站上车，往湘湖方向，8 站，车上约 20–22 分钟。" : "杭州南站上车，往城区方向，13 站，车上约 34 分钟。"}</p><div className="segmented transfer-mode"><button disabled={!selectedTrain.metro} className={effectiveHzMode === "metro" ? "active" : ""} onClick={() => setHzMode("metro")}>地铁 · {arrival === "east" ? "¥4" : "¥5"}/人</button><button className={effectiveHzMode === "taxi" ? "active" : ""} onClick={() => setHzMode("taxi")}>打车 · 约 {arrival === "east" ? "¥7.5" : "¥16.3"}/人</button></div>{!selectedTrain.metro && <div className="red-alert">{selectedTrain.no} {selectedTrain.arrive} 到杭州南：下车＋出站后赶不上约 22:35–22:36 的 5 号线末班，费用自动按打车平分。</div>}{selectedTrain.metro && arrival === "east" && selectedTrain.id === "c2349" && <div className="amber-alert">22:46 到、末班约 23:19，理论余量只有 33 分钟；晚点或找路都可能吃掉余量。</div>}<dl><div><dt>末班参考</dt><dd>{arrival === "east" ? "约 23:19" : "约 22:35–22:36"}</dd></div><div><dt>到酒店步行</dt><dd>待具体酒店名</dd></div><div><dt>每人落地成本</dt><dd>{money(hzFare)}</dd></div></dl></aside></div></section>

    <section className="hotels"><header className="section-heading"><span>07 / HOTEL WATCHLIST</span><h2>¥500 内先按区域筛，再按房名下单</h2><p>平台价随库存、会员和取消规则变化；以下是“值得打开查”的候选，不把搜索摘要伪装成 9 月 23 日锁价。</p></header><div className="hotel-grid">{hotelCards.map(card => <article key={card.name} className={zone === card.zone ? "highlight" : ""}><span>{card.price} / 晚参考</span><h3>{card.name}</h3><p><b>为什么看：</b>{card.why}</p><p><b>下单前查：</b>{card.risk}</p></article>)}</div><div className="booking-row"><a href="https://www.fliggy.com/" target="_blank" rel="noreferrer">飞猪查同日期 ↗</a><a href="https://www.ly.com/hotel/" target="_blank" rel="noreferrer">同程查同日期 ↗</a><a href="https://hotel.qunar.com/" target="_blank" rel="noreferrer">去哪儿查同日期 ↗</a></div><div className="hotel-checklist"><b>统一筛选：</b>2026-09-23 入住 / 09-24 退房 · 4 位成人 · 一间四人房或两间房总价 ≤ ¥500 · 免费取消优先 · 看最近 3 个月差评 · 确认“烟花散场接驳”和“退房后寄存到几点”。</div></section>

    <section className="sources"><header className="section-heading compact"><span>08 / VERIFICATION</span><h2>哪些已确认，哪些临出发再查</h2></header><div className="source-grid"><article><span>已确认</span><p>机票约 ¥560；迪士尼票 ¥366/人已买；A、B 从浦东一起去迪士尼；C、D 在园区会合；东方明珠不上塔；杭州酒店在杭州站附近。</p></article><article><span>临出发再查</span><p>9 月 23 日酒店锁价、接驳班次、寄存营业时间、9 月 24 日实际列车、地铁当日末班、项目临时关闭与烟花时间。</p></article><article><span>小红书状态</span><p>网页搜索连接很慢，当前没有把无法读取的笔记冒充来源。路线先以官方地图和可验证交通资料为底；成功读取后只补多人实测技巧，不覆盖官方规则。</p></article></div><div className="source-links"><a href="https://static.shanghaidisneyresort.com/web-img-gallery/park-map-260227.pdf" target="_blank" rel="noreferrer">迪士尼官方地图 PDF</a><a href="https://www.12306.cn/" target="_blank" rel="noreferrer">12306</a><a href="https://www.metroman.cn/cities/hangzhou/stations/east-railway-station" target="_blank" rel="noreferrer">杭州东末班参考</a><a href="https://www.metroman.cn/cities/hangzhou/stations/south-railway-station" target="_blank" rel="noreferrer">杭州南末班参考</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">离线底图 © OpenStreetMap</a></div></section>
    <footer><div><b>TRIP 001</b><span>深圳 → 上海 → 杭州</span></div><p>下一次旅行，继续贴在这里。</p><a href="#top">回到首图 ↑</a></footer>
  </main>;
}

function Control({title,value,onChange,options}:{title:string;value:string;onChange:(value:string)=>void;options:{id:string;label:string;meta:string}[]}) { return <fieldset className="control"><legend>{title}</legend><div>{options.map(option => <button type="button" key={option.id} className={value === option.id ? "active" : ""} onClick={() => onChange(option.id)}><b>{option.label}</b><span>{option.meta}</span></button>)}</div></fieldset>; }
function CostLine({name,amount,note}:{name:string;amount:number;note:string}) { return <div><span>{name}<small>{note}</small></span><b>{amount ? money(amount) : "—"}</b></div>; }
function EditableCost({label,value,setValue,max}:{label:string;value:number;setValue:(value:number)=>void;max:number}) { return <div className="editable-cost"><label><span>{label}</span><input type="number" min="0" max={max} step="1" value={value} onChange={e => setValue(Math.max(0, Number(e.target.value) || 0))}/></label><input aria-label={`${label}滑杆`} type="range" min="0" max={max} step="10" value={Math.min(value,max)} onChange={e => setValue(Number(e.target.value))}/></div>; }
function SimpleMap({city}:{city:"shanghai"|"hangzhou"}) { return <div className="simple-map">{city === "shanghai" ? <><span className="node n-air">浦东 T2</span><span className="node n-disney">迪士尼</span><span className="node n-tower">东方明珠</span><span className="node n-bund">外滩</span><span className="node n-south">上海南</span><i className="simple-line sl-one"/><i className="simple-line sl-two"/><i className="simple-line sl-three"/></> : <><span className="node n-east">杭州东</span><span className="node n-hotel">杭州站 / 酒店</span><span className="node n-hsouth">杭州南</span><span className="node n-lake">西湖</span><i className="simple-line hz-one"/><i className="simple-line hz-two"/></>}</div>; }
