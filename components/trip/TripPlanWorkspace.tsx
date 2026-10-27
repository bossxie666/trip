import dynamic from "next/dynamic";
import { PlanningPanels } from "./PlanningPanels";
import { WorkspaceNavLink } from "./WorkspaceNavLink";
import { DayPresenceControl } from "./DayPresenceControl";
import { ItineraryItemControl } from "./ItineraryItemControl";
import { ItineraryOrderControls } from "./ItineraryOrderControls";
import { PlanAddControl } from "./PlanAddControl";
import { BookingPlaceControl } from "./BookingPlaceControl";
import { BookingCreateControl } from "./BookingCreateControl";
import { BookingEditControl } from "./BookingEditControl";
import { AccommodationListControl } from "./AccommodationListControl";
import { PlaceDiscoveryControl } from "./PlaceDiscoveryControl";
import { ItineraryItemPlaceControl } from "./ItineraryItemPlaceControl";
import { TransportIcon, iconForBookingType, iconForItemType } from "./TransportIcon";
import { LocalRouteSegmentControl } from "./LocalRouteSegmentControl";
import { DayNavigation } from "./DayNavigation";
import { PlanningDesktopMap } from "./PlanningDesktopMap";
import type { getPlanWorkspace } from "@/services/plan-workspace-service.server";
import { resolveDayLabel } from "@/services/day-label";
import { filterTimelineForMember, numberTimelineNodes, type TimelineEdge, type TimelineNode } from "@/services/timeline-assembler";
import { isTransportBooking, transportDisplayLabel } from "@/services/booking-semantics";
import { summarizeAccommodation } from "@/services/accommodation-summary";
import { TripBookShell } from "./TripBookShell";
import { KnowledgeTripPicker } from "./KnowledgeTripPicker";
import { KnowledgeReferenceControl } from "./KnowledgeReferenceControl";

const PlanMap = dynamic(() => import("./PlanMap").then((module) => module.PlanMap));
const BudgetWorkspace = dynamic(() => import("./BudgetWorkspace").then((module) => module.BudgetWorkspace));

type Workspace = NonNullable<Awaited<ReturnType<typeof getPlanWorkspace>>>;
type View = "planning" | "map" | "budget";
type MapMode = "day" | "library";
type AreaFilter = "shanghai" | "hangzhou" | "tonglu";
type CategoryFilter = "all" | "core" | "attraction" | "food" | "shopping" | "day_trip" | "other" | "cafe" | "guide";

const Link = WorkspaceNavLink;

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

export function TripPlanWorkspace({ workspace, activeDayId, view, mapMode, query, areaFilter, categoryFilter, memberFilter = "all", costMode = "expected" }: { workspace: Workspace; activeDayId: string; view: View; mapMode: MapMode; query: string; areaFilter: AreaFilter; categoryFilter: CategoryFilter; memberFilter?: string; costMode?: "expected" | "actual" }) {
  const { trip, days, bookings } = workspace;
  const activeDay = days.find((day) => day.id === activeDayId) || days[0];
  const dayLabels = days.map((day) => ({ id: day.id, label: `${shortDate(day.date)} ${dayArea(day, bookings, trip.cities)}` }));
  const stageSummary = trip.stages?.length ? trip.stages.map((stage) => `${stage.city?.name || stage.title}${stage.members?.length || 0}人`).join(" · ") : `${trip.members?.length || trip.people}人参与`;

  const link = (nextView: View, dayId = activeDayId, mode = mapMode, nextMember = memberFilter, nextCost = costMode) => {
    const params = new URLSearchParams({ view: nextView, day: dayId, area: areaFilter, category: categoryFilter, member: nextMember });
    if (query) params.set("q", query);
    if (nextView === "map") params.set("mode", mode);
    if (nextView === "budget") params.set("cost", nextCost);
    return `/trips/${trip.slug}/plan?${params}`;
  };
  const existingPlaceChoices = [...new Map([...(workspace.savedPlaces || []).map(({ place, city }) => ({ id: place.id, name: place.name, address: place.address, district: place.district, cityName: city.name, source: "existing" as const })), ...(workspace.mapPlaces || []).map(({ place }) => ({ id: place.id, name: place.name, address: place.address, district: place.district, cityName: trip.cities.find((city) => city.id === place.cityId)?.name || null, source: "existing" as const }))].map((place) => [place.id, place])).values()];

  const existingTransport = workspace.bookings.filter(({ booking, memberStates }) => isTransportBooking(booking) && (!workspace.currentMemberId || memberStates?.[workspace.currentMemberId] !== "absent")).map(({ booking, originPlace, destinationPlace }) => ({ id: booking.id, title: booking.title, origin: originPlace ? { id: originPlace.id, name: originPlace.name, address: originPlace.address, district: originPlace.district, cityName: trip.cities.find((city) => city.id === originPlace.cityId)?.name, source: "existing" as const } : null, destination: destinationPlace ? { id: destinationPlace.id, name: destinationPlace.name, address: destinationPlace.address, district: destinationPlace.district, cityName: trip.cities.find((city) => city.id === destinationPlace.cityId)?.name, source: "existing" as const } : null, type: booking.type, totalAmountMinor: booking.totalAmountMinor }));

  const presenceControl = activeDay ? <DayPresenceControl slug={trip.slug} dayId={activeDay.id} dayLabel={`${shortDate(activeDay.date)} · ${dayArea(activeDay, bookings, trip.cities)}`} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} initialStates={workspace.dayPresenceByDay?.[activeDay.id] || {}} initialDetails={workspace.dayPresenceDetailsByDay?.[activeDay.id] || {}} /> : null;
  const timelineNodes = (activeDay ? (workspace.timelineNodesByDay?.[activeDay.id] || []) : []) as TimelineNode[];
  const timelineEdges = (activeDay ? (workspace.timelineEdgesByDay?.[activeDay.id] || []) : []) as TimelineEdge[];
  // Booking anchors (notably hotel check-in/stay/check-out) are order facts for
  // the old timeline service, not user-authored Day Plan nodes.  Only an
  // explicit ItineraryItem or a long-distance endpoint belongs on this
  // Planning axis.  Keeping this filter at the renderer boundary also means a
  // stale placement row can never resurrect a hotel node in the UI.
  const visibleTimeline = filterTimelineForMember(timelineNodes, memberFilter).filter((node) => node.nodeKind !== "anchor");
  const itemIds = activeDay?.items.map(({ item }) => item.id) || [];
  const nodeNumbers = numberTimelineNodes(visibleTimeline);

  const renderTimelineEdge = (edge: TimelineEdge | null, from?: TimelineNode, to?: TimelineNode) => {
    const bookingRecord = edge?.bookingId ? bookings.find(({ booking }) => booking.id === edge.bookingId) : null;
    if (edge?.kind === "long-distance" && bookingRecord) {
      const booking = bookingRecord.booking;
      const members = Object.entries(bookingRecord.memberStates || {}).filter(([, state]) => state === "present").map(([id]) => trip.members?.find((member) => member.id === id)?.displayName).filter((name): name is string => Boolean(name));
      const legacyService = booking.bookingReference?.match(/^(?:航班号|车次|交通编号)[:：]?\s*(.+)$/)?.[1] || "";
      const providerLabel = [booking.provider, legacyService].filter(Boolean).join(" ");
      const modeLabel = transportDisplayLabel(booking);
      const routeLabel = from && to ? `${from.title} → ${to.title}` : "起点 → 终点";
      return <div className="timeline-edge timeline-edge-booking" data-timeline-edge-kind="long-distance" data-timeline-edge-id={edge.id} key={edge.id}>
        <div className="timeline-edge-rail" aria-hidden="true"><span><TransportIcon kind={iconForBookingType(booking.type, booking.title)} size={15} /></span></div>
        <div className="timeline-edge-content"><div className="timeline-edge-heading"><b>{modeLabel}</b><span>{providerLabel || booking.title}</span></div><span className="timeline-edge-route">{routeLabel}</span><small>{bookingTime(booking)}{booking.totalAmountMinor != null ? ` · ${money(booking.totalAmountMinor)}` : ""}{members.length ? ` · ${members.join("、")}` : ""}</small></div>
      </div>;
    }
    const edgeId = edge?.id || `${from?.id || "unknown"}-${to?.id || "unknown"}:pending`;
    if (!edge || edge.kind !== "local" || !from?.place?.id || !to?.place?.id) return null;
    const initialMode = workspace.routePreferences.find((preference) => preference.dayId === activeDay?.id && preference.fromId === from.id && preference.toId === to.id && preference.memberId === workspace.currentMemberId)?.preferredMode || null;
    return <div className="timeline-edge timeline-edge-local local-route-control" data-timeline-edge-kind="local" data-timeline-edge-state={initialMode ? "selected" : "pending"} data-timeline-edge-id={edgeId} key={edgeId}><LocalRouteSegmentControl slug={trip.slug} dayId={activeDay!.id} edgeId={edgeId} from={{ id: from.id, source: from.source, placeId: from.place.id, title: from.title }} to={{ id: to.id, source: to.source, placeId: to.place.id, title: to.title }} initialMode={initialMode} /></div>;
  };

  const renderTimelineNode = (node: TimelineNode) => {
    const entryBookingId = node.bookingId || null;
    const entryBookingRecord = entryBookingId ? bookings.find(({ booking }) => booking.id === entryBookingId) : null;
    const entryBooking = entryBookingRecord?.booking || null;
    const detail = node.itemId ? activeDay?.items.find(({ item }) => item.id === node.itemId) : null;
    const displayTime = detail?.item.timeMode === "opening_hours" ? "开园 → 闭园" : node.timeLocal || (node.anchorKind === "start" ? "入住" : node.anchorKind === "stay" ? "住宿中" : node.anchorKind === "end" ? "退房" : "时间待定");
    const number = nodeNumbers.get(node.id);
    const transportEndpoint = Boolean(entryBooking && node.nodeKind === "endpoint" && isTransportBooking(entryBooking));
    const originPlace = entryBookingRecord?.originPlace;
    const destinationPlace = entryBookingRecord?.destinationPlace;
    return <article key={`${node.source}-${node.id}`} className={`timeline-node timeline-node-${node.nodeKind} ${node.source === "booking" ? "booking-entry" : "item-entry"}`} data-timeline-node-id={node.id} data-timeline-node-kind={node.nodeKind} data-timeline-node-source={node.source}>
      <div className="timeline-index">{number ? String(number).padStart(2, "0") : <TransportIcon kind={node.nodeKind === "anchor" ? "hotel" : iconForBookingType(entryBooking?.type || "", entryBooking?.title || "")} />}</div>
      <div className="timeline-node-content">
        <div className="timeline-meta"><span>{displayTime}</span><span>{node.nodeKind === "anchor" ? "住宿订单" : node.endpoint === "origin" ? "出发点" : node.endpoint === "destination" ? "到达点" : node.source === "booking" ? bookingStatus(entryBooking?.status || "tentative", entryBooking?.type || "") : detail?.item.lockedAt ? "已锁定" : "可调整"}</span></div>
        <h3 className="timeline-title"><TransportIcon kind={detail ? iconForItemType(detail.item.itemType, detail.item.title, detail.item.note || "") : node.nodeKind === "anchor" ? "hotel" : iconForBookingType(entryBooking?.type || "calendar", entryBooking?.title || "")} size={15} />{node.title}</h3>
        {transportEndpoint && node.endpoint === "origin" && entryBookingId && <div className="timeline-node-action"><BookingPlaceControl slug={trip.slug} bookingId={entryBookingId} slot="origin" cities={trip.cities.map((city) => ({ id: city.id, name: city.name }))} currentPlace={originPlace || null} currentLabel={entryBooking?.originLabel} label={originPlace ? "修改起点" : "完善起点"} /><BookingEditControl slug={trip.slug} booking={entryBookingRecord!} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingPlaces={existingPlaceChoices} /></div>}
        {transportEndpoint && node.endpoint === "destination" && entryBookingId && <div className="timeline-node-action"><BookingPlaceControl slug={trip.slug} bookingId={entryBookingId} slot="destination" cities={trip.cities.map((city) => ({ id: city.id, name: city.name }))} currentPlace={destinationPlace || null} currentLabel={entryBooking?.destinationLabel} label={destinationPlace ? "修改终点" : "完善终点"} /></div>}
        {detail && <>
          <p>{detail.item.placeId ? `地点：${detail.place?.name || "已绑定"}` : "地点待确认"}{detail.recommendationTitle ? ` · 来源：${detail.recommendationTitle}` : ""}{detail.item.timeMode === "opening_hours" ? ` · ${detail.item.openingHoursNote || "营业时间待确认"}` : ""}</p>
          {detail.knowledge && <KnowledgeReferenceControl slug={trip.slug} itemId={detail.item.id} entry={detail.knowledge} />}
          {detail.item.placeId ? null : <ItineraryItemPlaceControl slug={trip.slug} itemId={detail.item.id} cities={trip.cities.map((city) => ({ id: city.id, name: city.name }))} currentPlace={null} />}
          <div className="timeline-node-controls"><ItineraryItemControl slug={trip.slug} item={detail.item} days={dayLabels} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} participantStates={detail.participantStates} participantOverrides={detail.participantOverrides} dayPresenceState={workspace.dayPresenceByDay?.[activeDay!.id] || {}} allowOpeningHours={detail.item.itemType !== "lodging" && !/酒店|住宿|入住/.test(detail.item.title)} /><ItineraryOrderControls slug={trip.slug} dayId={activeDay!.id} itemId={detail.item.id} itemIds={itemIds} locked={Boolean(detail.item.lockedAt)} /></div>
        </>}
        {entryBooking && node.nodeKind === "anchor" && <p>{entryBooking.status === "confirmed" ? "已确认订单" : bookingStatus(entryBooking.status, entryBooking.type)}，成员与费用分别记录。{entryBooking.totalAmountMinor != null ? ` · ${money(entryBooking.totalAmountMinor)}` : ""}</p>}
      </div>
    </article>;
  };

  const timelineView = visibleTimeline.map((node, index) => {
    const next = visibleTimeline[index + 1];
    const edge = next ? timelineEdges.find((candidate) => candidate.from.id === node.id && candidate.to.id === next.id) || null : null;
    return <div className="timeline-sequence" key={node.id}>{renderTimelineNode(node)}{next ? renderTimelineEdge(edge, node, next) : null}</div>;
  });

  const itinerary = (
    <>
      <header className="panel-heading">
        <div><span>DAY PLAN</span><h2>{activeDay ? `${shortDate(activeDay.date)} · ${dayArea(activeDay, bookings, trip.cities)}` : "当天行程"}</h2></div>
        <div className="day-plan-actions">{presenceControl}<PlanAddControl slug={trip.slug} days={dayLabels} defaultDayId={activeDayId} currentMemberId={workspace.currentMemberId} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingTransport={existingTransport} existingPlaces={existingPlaceChoices} /></div>
      </header>
      <div className="plan-member-filter" aria-label="成员视角"><span>成员视角</span><WorkspaceNavLink className={memberFilter === "all" ? "active" : ""} href={link("planning", activeDayId, mapMode, "all")}>全体</WorkspaceNavLink>{(trip.members || []).map((member) => <WorkspaceNavLink className={memberFilter === member.id ? "active" : ""} href={link("planning", activeDayId, mapMode, member.id)} key={member.id}>{member.displayName}</WorkspaceNavLink>)}</div>
      <div className="plan-timeline">{timelineView}</div>
      {!visibleTimeline.length && <div className="plan-empty"><b>{memberFilter === "all" ? "尚未安排" : "该成员当天暂无已确认事项（尚未安排）"}</b><p>{memberFilter === "all" ? "这一天还没有正式行程事项，可以从左侧攻略素材中添加。" : "可以切换到全体视角查看当天完整安排。"}</p></div>}
    </>
  );

  const mapTimelineNodesByDay = Object.fromEntries(Object.entries(workspace.timelineNodesByDay || {}).map(([dayId, nodes]) => [dayId, memberFilter === "all" ? nodes : filterTimelineForMember(nodes as TimelineNode[], memberFilter)]));
  const mapTimelineEdgesByDay = Object.fromEntries(Object.entries(workspace.timelineEdgesByDay || {}).map(([dayId, edges]) => {
    if (memberFilter === "all") return [dayId, edges];
    const visibleNodeIds = new Set((mapTimelineNodesByDay[dayId] || []).map((node: TimelineNode) => node.id));
    return [dayId, (edges as TimelineEdge[]).filter((edge) => visibleNodeIds.has(edge.from.id) && visibleNodeIds.has(edge.to.id))];
  }));
  const mapRouteStopsByDay = Object.fromEntries(Object.entries(workspace.routeStopsByDay || {}).map(([dayId, stops]) => [dayId, memberFilter === "all" ? stops : stops.filter((stop) => stop.memberStates?.[memberFilter] !== "absent")]));
  const mapRouteSegmentsByDay = Object.fromEntries(Object.entries(workspace.routeSegmentsByDay || {}).map(([dayId, segments]) => [dayId, memberFilter === "all" ? segments : segments.filter((segment) => segment.from.memberStates?.[memberFilter] !== "absent" && segment.to.memberStates?.[memberFilter] !== "absent")]));
  const mapWorkspace = {
    days: workspace.days.map((day) => {
      const visibleItemIds = memberFilter === "all" ? null : new Set((mapTimelineNodesByDay[day.id] || []).map((node: TimelineNode) => node.itemId).filter(Boolean));
      return { id: day.id, dayNumber: day.dayNumber, date: day.date, title: day.title, items: day.items.filter(({ item }) => !visibleItemIds || visibleItemIds.has(item.id)).map(({ item, place }) => ({ item: { id: item.id, title: item.title, dayId: item.dayId, sortOrder: item.sortOrder, lockedAt: item.lockedAt, placeId: item.placeId, itemType: item.itemType }, place })) };
    }),
    cities: trip.cities.map((city) => ({ id: city.id, name: city.name })),
    members: (trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName })),
    bookings: workspace.bookings.filter(({ memberStates }) => memberFilter === "all" || memberStates?.[memberFilter] !== "absent").map(({ booking, originPlace, destinationPlace, memberStates }) => ({ id: booking.id, title: booking.title, type: booking.type, placeId: booking.placeId, originPlace, destinationPlace, originLabel: booking.originLabel, destinationLabel: booking.destinationLabel, memberStates })),
    currentMemberId: workspace.currentMemberId,
    mapPlaces: workspace.mapPlaces,
    savedPlaces: workspace.savedPlaces,
    routeStopsByDay: mapRouteStopsByDay,
    routeSegmentsByDay: mapRouteSegmentsByDay,
    timelineNodesByDay: mapTimelineNodesByDay,
    timelineEdgesByDay: mapTimelineEdgesByDay,
    routePreferences: workspace.routePreferences,
    memberFilter,
  };


  const hotelBookings = bookings.filter(({ booking }) => booking.type === "hotel");
  const accommodation = summarizeAccommodation(hotelBookings.map(({ booking }) => booking), workspace.costLines || []);
  const accommodationAmount = accommodation.amounts.length === 1
    ? `${accommodation.amounts[0].currency === "CNY" ? "¥" : `${accommodation.amounts[0].currency} `}${(accommodation.amounts[0].amountMinor / 100).toFixed(2).replace(/\.00$/, "")}`
    : accommodation.amounts.length > 1 ? "金额查看详情" : "金额未完整";
  const chapterOrder: View[] = ["planning", "map", "budget"];
  const chapterIndex = chapterOrder.indexOf(view);
  return <TripBookShell view={view} previousHref={chapterIndex > 0 ? link(chapterOrder[chapterIndex - 1]) : undefined} nextHref={chapterIndex < chapterOrder.length - 1 ? link(chapterOrder[chapterIndex + 1]) : undefined}><main className="trip-plan-page trip-journal-workspace">
    <header className="trip-console">
      <div className="console-title"><Link href="/trips">← 我的旅行</Link><span>TRIP CONSOLE</span><h1>{trip.title}</h1><p>{fullRange(trip.startDate, trip.endDate)} · {stageSummary}</p></div>
      <div className="trip-console-side"><div className="booking-console"><span className="booking-console-label">住宿</span>{hotelBookings.length ? <><div className="accommodation-summary"><strong>{accommodation.count}项 · {accommodation.incomplete && accommodation.amounts.length ? `已记录 ${accommodationAmount}` : accommodationAmount}</strong>{accommodation.tentativeCount ? <small>其中 {accommodation.confirmedCount} 项已确认，{accommodation.tentativeCount} 项计划中</small> : <small>{accommodation.confirmedCount} 项已确认</small>}</div><AccommodationListControl>{hotelBookings.map((record) => <article key={record.booking.id}><b className="booking-summary-title"><TransportIcon kind="hotel" size={15} />{record.booking.title.replace("附近", "")}</b><span>{bookingStatus(record.booking.status, record.booking.type)} · {bookingTime(record.booking)}</span><BookingEditControl slug={trip.slug} booking={record} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingPlaces={existingPlaceChoices} /></article>)}</AccommodationListControl></> : <p className="booking-console-empty">还没有添加住宿</p>}<BookingCreateControl slug={trip.slug} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} existingPlaces={existingPlaceChoices} /></div></div>
    </header>
    <DayNavigation items={days.map((day) => ({ id: day.id, href: link(view, day.id), dateLabel: shortDate(day.date), areaLabel: dayArea(day, bookings, trip.cities), active: day.id === activeDayId }))} />
    <nav className="plan-view-tabs" aria-label="工作台视图"><WorkspaceNavLink className={view === "planning" ? "active" : ""} href={link("planning")}>规划</WorkspaceNavLink><WorkspaceNavLink className={view === "map" ? "active" : ""} href={link("map")}>地图</WorkspaceNavLink><WorkspaceNavLink className={view === "budget" ? "active" : ""} href={link("budget")}>费用</WorkspaceNavLink></nav>
    {view === "planning" && <><div className="empty-trip-actions"><PlaceDiscoveryControl slug={trip.slug} days={dayLabels} existingPlaces={existingPlaceChoices} /></div><PlanningPanels library={<KnowledgeTripPicker slug={trip.slug} days={dayLabels} defaultDayId={activeDayId} />} itinerary={itinerary} map={<PlanningDesktopMap slug={trip.slug} workspace={mapWorkspace} activeDayId={activeDayId} mapMode="day" fullHref={link("map", activeDayId, "day")} />} /></>}
    {view === "map" && <section className="map-view"><header className="workspace-view-heading"><div><span>MAP</span><h2>{mapMode === "day" ? "行程路线" : "攻略地图"}</h2></div><nav><Link className={mapMode === "day" ? "active" : ""} href={link("map", activeDayId, "day")}>行程路线</Link><Link className={mapMode === "library" ? "active" : ""} href={link("map", activeDayId, "library")}>攻略地图</Link></nav></header><PlanMap slug={trip.slug} places={[]} workspace={mapWorkspace} activeDayId={activeDayId} mapMode={mapMode} /></section>}
    {view === "budget" && <BudgetWorkspace slug={trip.slug} budget={workspace.budget} members={(trip.members || []).map((member) => ({ id: member.id, displayName: member.displayName }))} days={dayLabels} cities={trip.cities.map((city) => ({ id: city.id, name: city.name }))} routeSegmentsByDay={workspace.routeSegmentsByDay} routePreferences={workspace.routePreferences} costMode={costMode} />}
  </main></TripBookShell>;
}




