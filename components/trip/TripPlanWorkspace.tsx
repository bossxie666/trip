/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages */
import { PlanningPanels } from "./PlanningPanels";
import { RecommendationAddControl } from "./RecommendationAddControl";
import { PlanMap } from "./PlanMap";
import { DayPresenceControl } from "./DayPresenceControl";
import { ItineraryItemControl } from "./ItineraryItemControl";
import { ItineraryOrderControls } from "./ItineraryOrderControls";
import { PlanAddControl } from "./PlanAddControl";
import { BudgetWorkspace } from "./BudgetWorkspace";
import { BookingPlaceControl } from "./BookingPlaceControl";
import { BookingCreateControl } from "./BookingCreateControl";
import { BookingEditControl } from "./BookingEditControl";
import { PlaceDiscoveryControl } from "./PlaceDiscoveryControl";
import { ItineraryItemPlaceControl } from "./ItineraryItemPlaceControl";
import { TransportIcon, iconForBookingType, iconForItemType } from "./TransportIcon";
import { MemberIdentityControl, type SessionMemberSummary } from "@/components/auth/MemberIdentityControl";
import { EditTripForm } from "./EditTripForm";
import type { getPlanWorkspace } from "@/services/plan-workspace-service.server";
import { resolveDayLabel } from "@/services/day-label";
import { filterTimelineForMember, numberTimelineNodes, type TimelineEdge, type TimelineNode } from "@/services/timeline-assembler";

type Workspace = NonNullable<Awaited<ReturnType<typeof getPlanWorkspace>>>;
type View = "planning" | "map" | "budget";
type MapMode = "day" | "library";
type AreaFilter = "shanghai" | "hangzhou" | "tonglu";
type CategoryFilter = "all" | "attraction" | "food" | "cafe" | "shopping" | "guide" | "other";
type LibrarySort = "core" | "recent";

const categoryLabels = { attraction: "景点", food: "美食", cafe: "咖啡", shopping: "购物", hotel: "酒店", experience: "体验", other: "其他" } as const;
const areaFilters: { key: AreaFilter; label: string }[] = [{ key: "shanghai", label: "上海" }, { key: "hangzhou", label: "杭州" }, { key: "tonglu", label: "桐庐" }];
const categoryFilters: { key: CategoryFilter; label: string }[] = [{ key: "all", label: "全部" }, { key: "attraction", label: "景点" }, { key: "food", label: "美食" }, { key: "cafe", label: "咖啡" }, { key: "shopping", label: "购物" }, { key: "guide", label: "攻略" }, { key: "other", label: "其他" }];

function money(value: number | null | undefined) { return value == null ? "—" : `¥${(value / 100).toFixed(2).replace(/\.00$/, "")}`; }
function shortDate(date: string | null) { return date ? date.slice(5).replace("-", "/") : "日期未定"; }
function fullRange(start: string | null, end: string | null) { if (!start || !end) return "日期未定"; return `${start.replaceAll("-", ".")} — ${end.slice(5).replaceAll("-", ".")}`; }
function dayArea(day: Workspace["days"][number], bookings: Workspace["bookings"] = [], cities: { id: string; name: string }[] = []) {
  return resolveDayLabel(day, bookings.map(({ booking, originPlace, destinationPlace }) => ({ ...booking, originPlace, destinationPlace })), cities);
}
function bookingStatus(status: string, type: string) { return status === "tentative" ? "计划中" : status === "cancelled" ? "已取消" : type === "flight" || type === "train" ? "已购" : "已订"; }
function bookingTime(booking: Workspace["bookings"][number]["booking"]) {
  if (booking.startAt && booking.endAt && booking.timezone) {
    const format = (value: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: booking.timezone!, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
    return `${format(booking.startAt)}–${format(booking.endAt)}`;
  }
  return `${shortDate(booking.startDateLocal)}–${shortDate(booking.endDateLocal)}`;
}

export function TripPlanWorkspace({ workspace, activeDayId, view, mapMode, query, areaFilter, categoryFilter, libraryMode = false, librarySort = "core", libraryPage = 1, memberFilter = "all", costMode = "expected", currentMember = null }: { workspace: Workspace; activeDayId: string; view: View; mapMode: MapMode; query: string; areaFilter: AreaFilter; categoryFilter: CategoryFilter; libraryMode?: boolean; librarySort?: LibrarySort; libraryPage?: number; memberFilter?: string; costMode?: "expected" | "actual"; currentMember?: SessionMemberSummary | null }) {
  const { trip, days, recommendations, bookings } = workspace;
  const activeDay = days.find((day) => day.id === activeDayId) || days[0];
  const dayLabels = days.map((day) => ({ id: day.id, label: `${shortDate(day.date)} ${dayArea(day, bookings, trip.cities)}` }));
  const stageSummary = trip.stages?.length ? trip.stages.map((stage) => `${stage.city?.name || stage.title}${stage.members?.length || 0}人`).join(" · ") : `${trip.members?.length || trip.people}人参与`;

  const filteredRecommendations = recommendations.filter((recommendation) => {
    const categoryMatches = categoryFilter === "all" || categoryFilter === "guide"
      ? categoryFilter === "all" || recommendation.kind === "guide"
      : categoryFilter === "other"
        ? recommendation.kind !== "guide" && ["other", "hotel", "experience"].includes(recommendation.category)
        : recommendation.kind !== "guide" && recommendation.category === categoryFilter;
    return recommendation.areaKey === areaFilter && categoryMatches && (!query || recommendation.title.toLowerCase().includes(query.toLowerCase()));
  });
  const sortedRecommendations = [...filteredRecommendations].sort((a, b) => librarySort === "recent" ? b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id) : Number(b.isCore) - Number(a.isCore) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const libraryPageSize = 12;
  const totalLibraryPages = Math.max(1, Math.ceil(sortedRecommendations.length / libraryPageSize));
  const currentLibraryPage = Math.min(Math.max(libraryPage, 1), totalLibraryPages);
  const displayedRecommendations = libraryMode ? sortedRecommendations.slice((currentLibraryPage - 1) * libraryPageSize, currentLibraryPage * libraryPageSize) : sortedRecommendations;

  const link = (nextView: View, dayId = activeDayId, mode = mapMode, nextMember = memberFilter, nextCost = costMode) => {
    const params = new URLSearchParams({ view: nextView, day: dayId, area: areaFilter, category: categoryFilter, member: nextMember });
    if (query) params.set("q", query);
    if (nextView === "map") params.set("mode", mode);
    if (nextView === "budget") params.set("cost", nextCost);
    return `/trips/${trip.slug}/plan?${params}`;
  };
  const libraryLink = (area = areaFilter, category = categoryFilter, full = false, page = 1) => {
    const params = new URLSearchParams({ view: "planning", day: activeDayId, area, category, member: memberFilter });
    if (query) params.set("q", query);
    if (full) {
      params.set("library", "all");
      params.set("sort", librarySort);
      if (page > 1) params.set("page", String(page));
    }
    return `/trips/${trip.slug}/plan?${params}`;
  };
  const librarySortLink = (sort: LibrarySort) => {
    const params = new URLSearchParams({ view: "planning", day: activeDayId, area: areaFilter, category: categoryFilter, member: memberFilter, library: "all", sort });
    if (query) params.set("q", query);
    return `/trips/${trip.slug}/plan?${params}`;
  };

  const library = (
    <>
      <header className="panel-heading">
        <div><span>LIBRARY</span><h2>{libraryMode ? "攻略资料库" : "攻略素材"}</h2></div>
        <form>
          <input type="hidden" name="view" value="planning" />
          <input type="hidden" name="day" value={activeDayId} />
          <input type="hidden" name="area" value={areaFilter} />
          <input type="hidden" name="category" value={categoryFilter} />
          {libraryMode && <><input type="hidden" name="library" value="all" /><input type="hidden" name="sort" value={librarySort} /></>}
          <input name="q" defaultValue={query} placeholder="搜索当前地域素材" aria-label="搜索攻略素材" />
          <button>搜索</button>
        </form>
      </header>
      <nav className="recommendation-area-filters" aria-label="素材地域">
        {areaFilters.map(({ key, label }) => <a className={areaFilter === key ? "active" : ""} href={libraryLink(key, categoryFilter, libraryMode)} key={key}>{label}</a>)}
      </nav>
      <nav className="recommendation-filters" aria-label="素材分类">
        {categoryFilters.map(({ key, label }) => <a className={categoryFilter === key ? "active" : ""} href={libraryLink(areaFilter, key, libraryMode)} key={key}>{label}</a>)}
      </nav>
      {libraryMode && <div className="library-sort-row"><span>{filteredRecommendations.length} 条素材</span><span>排序：<a className={librarySort === "core" ? "active" : ""} href={librarySortLink("core")}>核心推荐</a> · <a className={librarySort === "recent" ? "active" : ""} href={librarySortLink("recent")}>最近添加</a></span></div>}
      <div className="recommendation-section-title"><b>{areaFilters.find(({ key }) => key === areaFilter)?.label} · {categoryFilters.find(({ key }) => key === categoryFilter)?.label}</b><span>{libraryMode ? (sortedRecommendations.length ? `${(currentLibraryPage - 1) * libraryPageSize + 1}-${Math.min(currentLibraryPage * libraryPageSize, sortedRecommendations.length)} / ${sortedRecommendations.length}` : "0 条") : `${filteredRecommendations.length} 条`}</span></div>
      <div className="recommendation-grid">
        {displayedRecommendations.map((recommendation) => {
          const added = days.map((day) => ({ day, count: recommendation.addedDays.filter((dayId) => dayId === day.id).length })).filter(({ count }) => count > 0);
          return <article className="recommendation-card" key={recommendation.id}>
            {recommendation.coverImageUrl ? <img src={recommendation.coverImageUrl} alt="" /> : <div className="recommendation-cover"><span>{recommendation.kind === "guide" ? "GUIDE" : recommendation.areaKey?.toUpperCase() || "PLACE"}</span><i /></div>}
            <div className="recommendation-card-body">
              <div className="recommendation-tags"><span>{recommendation.isCore ? "核心" : "收藏"}</span><span>{recommendation.kind === "guide" ? "攻略" : categoryLabels[recommendation.category]}</span><span>{recommendation.areaLabel}</span></div>
              <h3>{recommendation.title}</h3>
              {(recommendation.estimatedDurationMinutes != null || recommendation.estimatedCostMinor != null) && <p>{recommendation.estimatedDurationMinutes != null ? `${recommendation.estimatedDurationMinutes} 分钟` : ""}{recommendation.estimatedCostMinor != null ? ` · ${money(recommendation.estimatedCostMinor)}` : ""}</p>}
              <p className="recommendation-state">{added.length ? `已加入 ${added.map(({ day, count }) => `${shortDate(day.date)}${count > 1 ? ` ×${count}` : ""}`).join(" · ")}` : "尚未加入正式行程"}{recommendation.locked ? " · 已锁定" : ""}</p>
              <RecommendationAddControl slug={trip.slug} recommendationId={recommendation.id} placeId={recommendation.options[0]?.place?.id || null} days={dayLabels} defaultDayId={activeDayId} addedDayIds={recommendation.addedDays} />
            </div>
          </article>;
        })}
      </div>
      {!displayedRecommendations.length && <div className="plan-empty">当前筛选下还没有攻略素材。</div>}
      {libraryMode && totalLibraryPages > 1 && <nav className="library-pagination" aria-label="攻略分页">{currentLibraryPage > 1 && <a href={libraryLink(areaFilter, categoryFilter, true, currentLibraryPage - 1)}>上一页</a>}{Array.from({ length: totalLibraryPages }, (_, index) => index + 1).map((page) => <a href={libraryLink(areaFilter, categoryFilter, true, page)} aria-current={page === currentLibraryPage ? "page" : undefined} key={page}>{page}</a>)}{currentLibraryPage < totalLibraryPages && <a href={libraryLink(areaFilter, categoryFilter, true, currentLibraryPage + 1)}>下一页</a>}</nav>}
      {libraryMode ? <a className="view-all-materials" href={libraryLink(areaFilter, categoryFilter)}>← 返回规划</a> : <a className="view-all-materials" href={libraryLink(areaFilter, categoryFilter, true)}>查看当前地域全部素材 →</a>}
    </>
  );

  const existingPlaceChoices = [...new Map([...(workspace.savedPlaces || []).map(({ place, city }) => ({ id: place.id, name: place.name, address: place.address, district: place.district, cityName: city.name, source: "existing" as const })), ...(workspace.mapPlaces || []).map(({ place }) => ({ id: place.id, name: place.name, address: place.address, district: place.district, cityName: trip.cities.find((city) => city.id === place.cityId)?.name || null, source: "existing" as const }))].map((place) => [place.id, place])).values()];
  const existingTransport = workspace.bookings.filter(({ booking, memberStates }) => ["flight", "train", "other"].includes(booking.type) && (!workspace.currentMemberId || memberStates?.[workspace.currentMemberId] !== "absent")).map(({ booking, originPlace, destinationPlace }) => ({ id: booking.id, title: booking.title, origin: booking.originLabel || originPlace?.name || "起点待确认", destination: booking.destinationLabel || destinationPlace?.name || "终点待确认", type: booking.type, totalAmountMinor: booking.totalAmountMinor }));

  const presenceControl = activeDay ? <DayPresenceControl slug={trip.slug} dayId={activeDay.id} dayLabel={`${shortDate(activeDay.date)} · ${dayArea(activeDay, bookings, trip.cities)}`} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} initialStates={workspace.dayPresenceByDay?.[activeDay.id] || {}} initialDetails={workspace.dayPresenceDetailsByDay?.[activeDay.id] || {}} /> : null;
  const timelineNodes = (activeDay ? (workspace.timelineNodesByDay?.[activeDay.id] || []) : []) as TimelineNode[];
  const timelineEdges = (activeDay ? (workspace.timelineEdgesByDay?.[activeDay.id] || []) : []) as TimelineEdge[];
  const visibleTimeline = filterTimelineForMember(timelineNodes, memberFilter);
  const itemIds = activeDay?.items.map(({ item }) => item.id) || [];
  const nodeNumbers = numberTimelineNodes(visibleTimeline);

  const renderTimelineEdge = (edge: TimelineEdge) => {
    const bookingRecord = edge.bookingId ? bookings.find(({ booking }) => booking.id === edge.bookingId) : null;
    if (edge.kind === "long-distance" && bookingRecord) {
      const members = Object.entries(bookingRecord.memberStates || {}).filter(([, state]) => state === "present").map(([id]) => trip.members?.find((member) => member.id === id)?.displayName).filter((name): name is string => Boolean(name));
      return <div className="timeline-edge timeline-edge-booking" key={edge.id}><TransportIcon kind={iconForBookingType(bookingRecord.booking.type, bookingRecord.booking.title)} size={15} /><div><b>{bookingRecord.booking.title}</b><span>{bookingStatus(bookingRecord.booking.status, bookingRecord.booking.type)} · {bookingTime(bookingRecord.booking)}{bookingRecord.booking.totalAmountMinor != null ? ` · ${money(bookingRecord.booking.totalAmountMinor)}` : ""}{members.length ? ` · ${members.join("、")}` : ""}</span></div></div>;
    }
    return <div className="timeline-edge timeline-edge-local" key={edge.id}><span>交通方式待选择</span><small>相邻地点之间的本地路线由地图视图计算</small></div>;
  };

  const renderTimelineNode = (node: TimelineNode) => {
    const entryBookingId = node.bookingId || null;
    const entryBookingRecord = entryBookingId ? bookings.find(({ booking }) => booking.id === entryBookingId) : null;
    const entryBooking = entryBookingRecord?.booking || null;
    const detail = node.itemId ? activeDay?.items.find(({ item }) => item.id === node.itemId) : null;
    const displayTime = detail?.item.timeMode === "opening_hours" ? "开园 → 闭园" : node.timeLocal || (node.anchorKind === "start" ? "入住" : node.anchorKind === "stay" ? "住宿中" : node.anchorKind === "end" ? "退房" : "时间待定");
    const memberNames = Object.entries(node.memberStates || {}).filter(([, state]) => state === "present").map(([id]) => trip.members?.find((member) => member.id === id)?.displayName).filter((name): name is string => Boolean(name));
    const number = nodeNumbers.get(node.id);
    const isTransportBooking = Boolean(entryBooking && ["flight", "train", "other"].includes(entryBooking.type));
    const bookingPlace = entryBookingRecord?.place;
    const originPlace = entryBookingRecord?.originPlace;
    const destinationPlace = entryBookingRecord?.destinationPlace;
    return <article key={`${node.source}-${node.id}`} className={node.nodeKind === "anchor" ? "booking-entry timeline-anchor" : node.source === "booking" ? "booking-entry" : "item-entry"}>
      <div className="timeline-index">{number ? String(number).padStart(2, "0") : <TransportIcon kind={node.nodeKind === "anchor" ? "hotel" : iconForBookingType(entryBooking?.type || "", entryBooking?.title || "")} />}</div>
      <div>
        <div className="timeline-meta"><span>{displayTime}</span><span>{node.nodeKind === "anchor" ? "住宿订单" : node.source === "booking" ? bookingStatus(entryBooking?.status || "tentative", entryBooking?.type || "") : detail?.item.lockedAt ? "已锁定" : "可调整"}</span></div>
        {isTransportBooking && node.endpoint === "origin" && entryBookingId && <div className="transport-endpoint transport-origin"><span>{originPlace?.name || entryBooking?.originLabel || "起点待确认"}</span><BookingPlaceControl slug={trip.slug} bookingId={entryBookingId} slot="origin" cities={trip.cities.map((city) => ({ id: city.id, name: city.name }))} currentPlace={originPlace || null} currentLabel={entryBooking?.originLabel} label={originPlace ? "修改起点" : "完善起点"} /></div>}
        {isTransportBooking && node.endpoint === "destination" && entryBookingId && <div className="transport-endpoint transport-destination"><span>{destinationPlace?.name || entryBooking?.destinationLabel || "终点待确认"}</span><BookingPlaceControl slug={trip.slug} bookingId={entryBookingId} slot="destination" cities={trip.cities.map((city) => ({ id: city.id, name: city.name }))} currentPlace={destinationPlace || null} currentLabel={entryBooking?.destinationLabel} label={destinationPlace ? "修改终点" : "完善终点"} /></div>}
        <h3 className="timeline-title"><TransportIcon kind={detail ? iconForItemType(detail.item.itemType, detail.item.title, detail.item.note || "") : node.nodeKind === "anchor" ? "hotel" : iconForBookingType(entryBooking?.type || "calendar", entryBooking?.title || "")} size={15} />{node.title}</h3>
        {detail && <>
          <p>{detail.item.placeId ? `地点：${detail.place?.name || "已绑定"}` : "地点待确认"}{detail.recommendationTitle ? ` · 来源：${detail.recommendationTitle}` : ""}{detail.item.timeMode === "opening_hours" ? ` · ${detail.item.openingHoursNote || "营业时间待确认"}` : ""}</p>
          {detail.item.placeId ? null : <ItineraryItemPlaceControl slug={trip.slug} itemId={detail.item.id} cities={trip.cities.map((city) => ({ id: city.id, name: city.name }))} currentPlace={null} />}
          <ItineraryOrderControls slug={trip.slug} dayId={activeDay!.id} itemId={detail.item.id} itemIds={itemIds} locked={Boolean(detail.item.lockedAt)} />
          <ItineraryItemControl slug={trip.slug} item={detail.item} days={dayLabels} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} participantStates={detail.participantStates} participantOverrides={detail.participantOverrides} dayPresenceState={workspace.dayPresenceByDay?.[activeDay!.id] || {}} allowOpeningHours={detail.item.itemType !== "lodging" && !/酒店|住宿|入住/.test(detail.item.title)} />
        </>}
        {entryBooking && node.nodeKind === "anchor" && <p>{entryBooking.status === "confirmed" ? "已确认订单" : bookingStatus(entryBooking.status, entryBooking.type)}，成员与费用分别记录。{entryBooking.totalAmountMinor != null ? ` · ${money(entryBooking.totalAmountMinor)}` : ""}{memberNames.length ? ` · ${memberNames.join("、")}` : ""}</p>}
        {entryBooking && node.nodeKind === "endpoint" && node.endpoint === "origin" && <><p>{entryBooking.title} · {entryBooking.status === "confirmed" ? "已确认订单" : bookingStatus(entryBooking.status, entryBooking.type)}{entryBooking.totalAmountMinor != null ? ` · ${money(entryBooking.totalAmountMinor)}` : ""}{memberNames.length ? ` · ${memberNames.join("、")}` : ""}</p><BookingEditControl slug={trip.slug} booking={entryBookingRecord!} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingPlaces={existingPlaceChoices} /></>}
        {entryBooking?.type === "hotel" && node.nodeKind === "anchor" && <div className="transport-endpoint booking-place"><span>{bookingPlace?.name || "酒店地点待确认"}</span><BookingEditControl slug={trip.slug} booking={entryBookingRecord!} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingPlaces={existingPlaceChoices} /></div>}
      </div>
    </article>;
  };

  const timelineView = visibleTimeline.map((node, index) => <div className="timeline-sequence" key={node.id}>{index > 0 && (() => { const previous = visibleTimeline[index - 1]; const edge = timelineEdges.find((candidate) => candidate.from.id === previous.id && candidate.to.id === node.id); return edge ? renderTimelineEdge(edge) : null; })()}{renderTimelineNode(node)}</div>);

  const itinerary = (
    <>
      <header className="panel-heading">
        <div><span>DAY PLAN</span><h2>{activeDay ? `${shortDate(activeDay.date)} · ${dayArea(activeDay, bookings, trip.cities)}` : "当天行程"}</h2></div>
        <div className="day-plan-actions">{presenceControl}<PlanAddControl slug={trip.slug} days={dayLabels} defaultDayId={activeDayId} currentMemberId={workspace.currentMemberId} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingTransport={existingTransport} existingPlaces={existingPlaceChoices} /></div>
      </header>
      <div className="plan-member-filter" aria-label="成员视角"><span>成员视角</span><a className={memberFilter === "all" ? "active" : ""} href={link("planning", activeDayId, mapMode, "all")}>全体</a>{(trip.members || []).map((member) => <a className={memberFilter === member.id ? "active" : ""} href={link("planning", activeDayId, mapMode, member.id)} key={member.id}>{member.displayName}</a>)}</div>
      <div className="plan-timeline">{timelineView}</div>
      {!visibleTimeline.length && <div className="plan-empty"><b>{memberFilter === "all" ? "尚未安排" : "该成员当天暂无已确认事项（尚未安排）"}</b><p>{memberFilter === "all" ? "这一天还没有正式行程事项，可以从左侧攻略素材中添加。" : "可以切换到全体视角查看当天完整安排。"}</p></div>}
    </>
  );

  const mapWorkspace = {
    days: workspace.days.map((day) => ({ id: day.id, dayNumber: day.dayNumber, date: day.date, title: day.title, items: day.items.map(({ item, place }) => ({ item: { id: item.id, title: item.title, dayId: item.dayId, sortOrder: item.sortOrder, lockedAt: item.lockedAt, placeId: item.placeId, itemType: item.itemType }, place })) })),
    cities: trip.cities.map((city) => ({ id: city.id, name: city.name })),
    members: (trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName })),
    bookings: workspace.bookings.map(({ booking, originPlace, destinationPlace, memberStates }) => ({ id: booking.id, title: booking.title, type: booking.type, placeId: booking.placeId, originPlace, destinationPlace, originLabel: booking.originLabel, destinationLabel: booking.destinationLabel, memberStates })),
    currentMemberId: workspace.currentMemberId,
    mapPlaces: workspace.mapPlaces,
    savedPlaces: workspace.savedPlaces,
    routeStopsByDay: workspace.routeStopsByDay,
    routeSegmentsByDay: workspace.routeSegmentsByDay,
    timelineNodesByDay: workspace.timelineNodesByDay,
    timelineEdgesByDay: workspace.timelineEdgesByDay,
    routePreferences: workspace.routePreferences,
    memberFilter,
  };

  if (libraryMode) return <main className="trip-plan-page recommendation-library-page"><header className="trip-console library-console"><div className="console-title"><a href={libraryLink(areaFilter, categoryFilter)}>← 返回规划</a><span>TRIP LIBRARY</span><h1>{trip.title} · 攻略资料库</h1><p>浏览素材与攻略，选择目标 Day 后再加入正式行程。</p></div><MemberIdentityControl currentMember={currentMember} /></header><section className="recommendation-library-full">{library}</section></main>;

  const hotelBookings = bookings.filter(({ booking }) => booking.type === "hotel");
  return <main className="trip-plan-page">
    <header className="trip-console">
      <div className="console-title"><a href="/trips">← 攻略中心</a><span>TRIP CONSOLE</span><h1>{trip.title}</h1><p>{fullRange(trip.startDate, trip.endDate)} · {stageSummary}</p></div>
      <div className="trip-console-side"><MemberIdentityControl currentMember={currentMember} />{!trip.protected && <details className="trip-settings"><summary>编辑旅行</summary><EditTripForm trip={trip} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} /></details>}<div className="booking-console"><span className="booking-console-label">住宿</span>{hotelBookings.map((record) => <article key={record.booking.id}><b className="booking-summary-title"><TransportIcon kind="hotel" size={15} />{record.booking.title.replace("附近", "")}</b><span>{bookingStatus(record.booking.status, record.booking.type)} · {bookingTime(record.booking)}</span><strong><small>总价 {money(record.booking.totalAmountMinor)}</small></strong><BookingEditControl slug={trip.slug} booking={record} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingPlaces={existingPlaceChoices} /></article>)}{!hotelBookings.length && <p className="booking-console-empty">还没有添加住宿</p>}<BookingCreateControl slug={trip.slug} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingPlaces={existingPlaceChoices} /></div></div>
    </header>
    <nav className="day-navigation" aria-label="选择日期">{days.map((day) => <a className={day.id === activeDayId ? "active" : ""} key={day.id} href={link(view, day.id)}><b>{shortDate(day.date)}</b><span>{dayArea(day, bookings, trip.cities)}</span></a>)}</nav>
    <nav className="plan-view-tabs" aria-label="工作台视图"><a className={view === "planning" ? "active" : ""} href={link("planning")}>规划</a><a className={view === "map" ? "active" : ""} href={link("map")}>地图</a><a className={view === "budget" ? "active" : ""} href={link("budget")}>费用</a></nav>
    {view === "planning" && <><div className="empty-trip-actions"><PlaceDiscoveryControl slug={trip.slug} days={dayLabels} existingPlaces={existingPlaceChoices} /></div><PlanningPanels library={library} itinerary={itinerary} /></>}
    {view === "map" && <section className="map-view"><header className="workspace-view-heading"><div><span>MAP</span><h2>{mapMode === "day" ? "行程路线" : "攻略地图"}</h2></div><nav><a className={mapMode === "day" ? "active" : ""} href={link("map", activeDayId, "day")}>行程路线</a><a className={mapMode === "library" ? "active" : ""} href={link("map", activeDayId, "library")}>攻略地图</a></nav></header><PlanMap slug={trip.slug} places={[]} workspace={mapWorkspace} activeDayId={activeDayId} mapMode={mapMode} /></section>}
    {view === "budget" && <BudgetWorkspace slug={trip.slug} budget={workspace.budget} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} days={dayLabels} cities={trip.cities.map((city) => ({ id: city.id, name: city.name }))} routeSegmentsByDay={workspace.routeSegmentsByDay} routePreferences={workspace.routePreferences} costMode={costMode} />}
  </main>;
}
