import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const memberRecords = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("idx_members_name").on(table.name)]);

/**
 * Small, application-level sliding-window counters used for endpoints that
 * can be brute-forced or spend an external API quota.  The key is a one-way
 * digest (never a raw IP or member name), and rows are safe to prune by age.
 */
export const rateLimitRecords = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStartedAt: integer("window_started_at").notNull(),
  count: integer("count").notNull(),
}, (table) => [index("idx_rate_limits_window").on(table.windowStartedAt)]);

export const tripRecords = sqliteTable("trips", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["inspiration", "planning", "completed"] }).notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  people: integer("people").notNull().default(1),
  cover: text("cover"),
  timezone: text("timezone"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  protected: integer("protected", { mode: "boolean" }).notNull().default(false),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
}, (table) => [
  uniqueIndex("idx_trips_slug").on(table.slug),
  index("idx_trips_status_created").on(table.status, table.createdAt),
]);

export const tripMemberRecords = sqliteTable("trip_members", {
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "cascade" }),
  presenceCoverage: text("presence_coverage", { enum: ["unknown", "complete"] }).notNull().default("unknown"),
}, (table) => [
  primaryKey({ columns: [table.tripId, table.memberId] }),
  index("idx_trip_members_member").on(table.memberId),
]);

export const cityRecords = sqliteTable("cities", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  centerLat: real("center_lat"),
  centerLng: real("center_lng"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_cities_name").on(table.name),
  uniqueIndex("idx_cities_slug").on(table.slug),
]);

export const placeRecords = sqliteTable("places", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cityId: text("city_id").notNull().references(() => cityRecords.id, { onDelete: "restrict" }),
  address: text("address"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  coordinateSystem: text("coordinate_system", { enum: ["WGS84", "GCJ02"] }),
  provider: text("provider", { enum: ["amap", "osm", "manual"] }).default("manual"),
  providerPlaceId: text("provider_place_id"),
  adcode: text("adcode"),
  cityCode: text("city_code"),
  district: text("district"),
  typeCode: text("type_code"),
  providerUpdatedAt: text("provider_updated_at"),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_places_city_name").on(table.cityId, table.name),
  index("idx_places_city_created").on(table.cityId, table.createdAt),
  uniqueIndex("idx_places_provider_id").on(table.provider, table.providerPlaceId),
]);

export const tripPlaceRecords = sqliteTable("trip_places", {
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  placeId: text("place_id").notNull().references(() => placeRecords.id, { onDelete: "restrict" }),
  planStatus: text("plan_status", { enum: ["candidate", "selected", "locked"] }).notNull().default("candidate"),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.tripId, table.placeId] }), index("idx_trip_places_place").on(table.placeId)]);

export const tripStageRecords = sqliteTable("trip_stages", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  cityId: text("city_id").notNull().references(() => cityRecords.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_trip_stages_trip_order").on(table.tripId, table.sortOrder),
  index("idx_trip_stages_trip").on(table.tripId),
]);

export const tripStageMemberRecords = sqliteTable("trip_stage_members", {
  stageId: text("stage_id").notNull().references(() => tripStageRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.stageId, table.memberId] }),
  index("idx_trip_stage_members_member").on(table.memberId),
]);

export const tripCityRecords = sqliteTable("trip_cities", {
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  cityId: text("city_id").notNull().references(() => cityRecords.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.tripId, table.cityId] }),
  index("idx_trip_cities_trip_position").on(table.tripId, table.position),
]);

export const dayRecords = sqliteTable("days", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  date: text("date"),
  title: text("title").notNull(),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("idx_days_trip_day_number").on(table.tripId, table.dayNumber),
]);

export const recommendationRecords = sqliteTable("recommendations", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["place", "guide"] }).notNull(),
  guideType: text("guide_type", { enum: ["day_trip"] }),
  category: text("category", { enum: ["attraction", "food", "cafe", "shopping", "hotel", "experience", "other"] }).notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  areaLabel: text("area_label"),
  areaKey: text("area_key"),
  isCore: integer("is_core", { mode: "boolean" }).notNull().default(false),
  estimatedDurationMinutes: integer("estimated_duration_minutes"),
  estimatedCostMinor: integer("estimated_cost_minor"),
  costBasis: text("cost_basis"),
  priceMinMinor: integer("price_min_minor"),
  priceMaxMinor: integer("price_max_minor"),
  priceCurrency: text("price_currency"),
  priceBasis: text("price_basis", { enum: ["per_person", "per_group", "per_item", "free", "unknown"] }),
  sourceLabel: text("source_label"),
  sourceUrl: text("source_url"),
  coverImageUrl: text("cover_image_url"),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_recommendations_trip_category").on(table.tripId, table.deletedAt, table.category),
  index("idx_recommendations_trip_area_core").on(table.tripId, table.areaKey, table.isCore),
  index("idx_recommendations_trip_created").on(table.tripId, table.createdAt),
]);

export const recommendationPlaceOptionRecords = sqliteTable("recommendation_place_options", {
  id: text("id").primaryKey(),
  recommendationId: text("recommendation_id").notNull().references(() => recommendationRecords.id, { onDelete: "cascade" }),
  placeId: text("place_id").notNull().references(() => placeRecords.id, { onDelete: "restrict" }),
  relationType: text("relation_type", { enum: ["alternative", "component"] }).notNull(),
  optionGroupKey: text("option_group_key"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_rec_place_options_relation").on(table.recommendationId, table.placeId, table.relationType),
  index("idx_rec_place_options_order").on(table.recommendationId, table.relationType, table.optionGroupKey, table.sortOrder),
  index("idx_rec_place_options_place").on(table.placeId),
]);

export const recommendationReferenceRecords = sqliteTable("recommendation_references", {
  id: text("id").primaryKey(),
  recommendationId: text("recommendation_id").notNull().references(() => recommendationRecords.id, { onDelete: "cascade" }),
  platform: text("platform", { enum: ["official", "xiaohongshu", "web", "manual"] }).notNull(),
  authorLabel: text("author_label"),
  title: text("title"),
  sourceUrl: text("source_url").notNull(),
  imageUrlsJson: text("image_urls_json"),
  note: text("note"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_recommendation_references_order").on(table.recommendationId, table.sortOrder),
]);

/** Metadata for private binary assets. The browser uploads bytes directly to
 * R2; application pages only persist and query these ownership records. */
export const mediaAssetRecords = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  uploaderMemberId: text("uploader_member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  purpose: text("purpose", { enum: ["home_featured", "guestbook", "recommendation_reference", "trip_cover", "album", "member_avatar"] }).notNull(),
  objectKey: text("object_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  status: text("status", { enum: ["pending", "ready", "failed"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  readyAt: text("ready_at"),
}, (table) => [
  uniqueIndex("idx_media_assets_object_key").on(table.objectKey),
  index("idx_media_assets_owner_purpose").on(table.uploaderMemberId, table.purpose, table.createdAt),
  index("idx_media_assets_status_created").on(table.status, table.createdAt),
]);

export const recommendationReferenceMediaRecords = sqliteTable("recommendation_reference_media", {
  referenceId: text("reference_id").notNull().references(() => recommendationReferenceRecords.id, { onDelete: "cascade" }),
  mediaAssetId: text("media_asset_id").notNull().references(() => mediaAssetRecords.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull(),
}, (table) => [
  primaryKey({ columns: [table.referenceId, table.mediaAssetId] }),
  uniqueIndex("idx_recommendation_reference_media_order").on(table.referenceId, table.sortOrder),
]);

export const homeFeaturedPhotoRecords = sqliteTable("home_featured_photos", {
  slotKey: text("slot_key", { enum: ["map_primary", "map_secondary"] }).primaryKey(),
  mediaAssetId: text("media_asset_id").notNull().references(() => mediaAssetRecords.id, { onDelete: "restrict" }),
  updatedByMemberId: text("updated_by_member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_home_featured_media").on(table.mediaAssetId)]);

export const guestbookMessageRecords = sqliteTable("guestbook_messages", {
  id: text("id").primaryKey(),
  authorMemberId: text("author_member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  body: text("body"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_guestbook_messages_visible").on(table.deletedAt, table.createdAt),
  index("idx_guestbook_messages_author").on(table.authorMemberId, table.createdAt),
]);

export const guestbookMessageMediaRecords = sqliteTable("guestbook_message_media", {
  messageId: text("message_id").notNull().references(() => guestbookMessageRecords.id, { onDelete: "cascade" }),
  mediaAssetId: text("media_asset_id").notNull().references(() => mediaAssetRecords.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull(),
}, (table) => [
  primaryKey({ columns: [table.messageId, table.mediaAssetId] }),
  uniqueIndex("idx_guestbook_message_media_order").on(table.messageId, table.sortOrder),
]);

export const albumRecords = sqliteTable("albums", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  tripId: text("trip_id").references(() => tripRecords.id, { onDelete: "restrict" }),
  createdByMemberId: text("created_by_member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  coverMediaAssetId: text("cover_media_asset_id").references(() => mediaAssetRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_albums_visible_updated").on(table.deletedAt, table.updatedAt),
  index("idx_albums_trip_updated").on(table.tripId, table.updatedAt),
]);

export const albumMediaRecords = sqliteTable("album_media", {
  albumId: text("album_id").notNull().references(() => albumRecords.id, { onDelete: "cascade" }),
  mediaAssetId: text("media_asset_id").notNull().references(() => mediaAssetRecords.id, { onDelete: "restrict" }),
  uploadedByMemberId: text("uploaded_by_member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull(),
  capturedAt: text("captured_at"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.albumId, table.mediaAssetId] }),
  uniqueIndex("idx_album_media_order").on(table.albumId, table.sortOrder),
  index("idx_album_media_asset").on(table.mediaAssetId),
]);

export const albumTagRecords = sqliteTable("album_tags", {
  id: text("id").primaryKey(),
  albumId: text("album_id").notNull().references(() => albumRecords.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_album_tags_name").on(table.albumId, table.name),
]);

export const albumMediaTagRecords = sqliteTable("album_media_tags", {
  albumId: text("album_id").notNull(),
  mediaAssetId: text("media_asset_id").notNull(),
  tagId: text("tag_id").notNull().references(() => albumTagRecords.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.albumId, table.mediaAssetId, table.tagId] }),
  index("idx_album_media_tags_tag").on(table.tagId),
]);

export const recommendationMemberStateRecords = sqliteTable("recommendation_member_states", {
  recommendationId: text("recommendation_id").notNull().references(() => recommendationRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "cascade" }),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.recommendationId, table.memberId] }),
  index("idx_rec_member_states_member").on(table.memberId, table.isFavorite),
]);

export const bookingRecords = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["flight", "hotel", "train", "ticket", "other"] }).notNull(),
  status: text("status", { enum: ["tentative", "confirmed", "cancelled"] }).notNull(),
  title: text("title").notNull(),
  provider: text("provider"),
  temporalKind: text("temporal_kind", { enum: ["instant", "interval", "date_range"] }).notNull(),
  startAt: text("start_at"),
  endAt: text("end_at"),
  startDateLocal: text("start_date_local"),
  endDateLocal: text("end_date_local"),
  timezone: text("timezone"),
  placeId: text("place_id").references(() => placeRecords.id, { onDelete: "restrict" }),
  originPlaceId: text("origin_place_id").references(() => placeRecords.id, { onDelete: "restrict" }),
  destinationPlaceId: text("destination_place_id").references(() => placeRecords.id, { onDelete: "restrict" }),
  // Free-text endpoint labels are independent from concrete Place bindings.
  // They let a member record a city/station/airport that is not yet resolved
  // without guessing a POI, and survive clearing/rebinding an endpoint.
  originLabel: text("origin_label"),
  destinationLabel: text("destination_label"),
  totalAmountMinor: integer("total_amount_minor"),
  currency: text("currency"),
  bookingReference: text("booking_reference"),
  notes: text("notes"),
  protected: integer("protected", { mode: "boolean" }).notNull().default(false),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_bookings_trip_status_start").on(table.tripId, table.status, table.startAt),
  index("idx_bookings_trip_local_date").on(table.tripId, table.startDateLocal),
]);

export const bookingParticipantRecords = sqliteTable("booking_participants", {
  bookingId: text("booking_id").notNull().references(() => bookingRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  role: text("role").notNull().default("covered"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.bookingId, table.memberId] }),
  index("idx_booking_participants_member").on(table.memberId),
]);

export const bookingCostLineRecords = sqliteTable("booking_cost_lines", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookingRecords.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  serviceStartDate: text("service_start_date"),
  serviceEndDate: text("service_end_date"),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  allocationMode: text("allocation_mode", { enum: ["equal", "custom"] }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_booking_cost_lines_order").on(table.bookingId, table.sortOrder),
]);

export const bookingCostAllocationRecords = sqliteTable("booking_cost_allocations", {
  id: text("id").primaryKey(),
  costLineId: text("cost_line_id").notNull().references(() => bookingCostLineRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  amountMinor: integer("amount_minor").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_booking_allocations_member").on(table.costLineId, table.memberId),
  index("idx_booking_allocations_member_lookup").on(table.memberId),
]);

export const memberBudgetPlanRecords = sqliteTable("member_budget_plans", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  category: text("category", { enum: ["food", "local_transport", "entertainment", "shopping", "other"] }).notNull(),
  plannedAmountMinor: integer("planned_amount_minor").notNull(),
  currency: text("currency").notNull().default("CNY"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_member_budget_plans_trip_member_category").on(table.tripId, table.memberId, table.category),
  index("idx_member_budget_plans_trip_member").on(table.tripId, table.memberId),
]);

export const expenseRecords = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  dayId: text("day_id").references(() => dayRecords.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  category: text("category", { enum: ["food", "local_transport", "entertainment", "shopping", "other"] }).notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("CNY"),
  scope: text("scope", { enum: ["personal", "shared"] }).notNull(),
  paidByMemberId: text("paid_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdByMemberId: text("created_by_member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  notes: text("notes"),
  occurredAt: text("occurred_at"),
  occurredDate: text("occurred_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_expenses_trip_date").on(table.tripId, table.occurredDate, table.createdAt),
  index("idx_expenses_trip_creator").on(table.tripId, table.createdByMemberId, table.deletedAt),
  index("idx_expenses_day").on(table.dayId),
]);

export const expenseAllocationRecords = sqliteTable("expense_allocations", {
  id: text("id").primaryKey(),
  expenseId: text("expense_id").notNull().references(() => expenseRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  amountMinor: integer("amount_minor").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_expense_allocations_expense_member").on(table.expenseId, table.memberId),
  index("idx_expense_allocations_member").on(table.memberId),
]);

export const memberPresenceWindowRecords = sqliteTable("member_presence_windows", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  stageId: text("stage_id").references(() => tripStageRecords.id, { onDelete: "restrict" }),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  timezone: text("timezone").notNull(),
  note: text("note"),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_presence_trip_member_start").on(table.tripId, table.memberId, table.startsAt),
  index("idx_presence_trip_stage_start").on(table.tripId, table.stageId, table.startsAt),
]);

/** Explicit day-level presence decisions.  A missing row means the day has
 * not been confirmed yet; it is never interpreted as absent or present.  The
 * interval columns are only used for partial-day presence and remain separate
 * from the actual MemberPresenceWindow facts. */
export const dayPresenceRecords = sqliteTable("day_member_presence", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  dayId: text("day_id").notNull().references(() => dayRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  state: text("state", { enum: ["present", "absent", "partial"] }).notNull(),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_day_member_presence_unique").on(table.dayId, table.memberId),
  index("idx_day_member_presence_trip_day").on(table.tripId, table.dayId),
]);

export const itineraryItemRecords = sqliteTable("itinerary_items", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  dayId: text("day_id").notNull().references(() => dayRecords.id, { onDelete: "restrict" }),
  stageId: text("stage_id").references(() => tripStageRecords.id, { onDelete: "restrict" }),
  recommendationId: text("recommendation_id").references(() => recommendationRecords.id, { onDelete: "set null" }),
  placeId: text("place_id").references(() => placeRecords.id, { onDelete: "restrict" }),
  originPlaceId: text("origin_place_id").references(() => placeRecords.id, { onDelete: "restrict" }),
  destinationPlaceId: text("destination_place_id").references(() => placeRecords.id, { onDelete: "restrict" }),
  itemType: text("item_type", { enum: ["place", "meal", "transit", "lodging", "activity", "note"] }).notNull(),
  title: text("title").notNull(),
  note: text("note"),
  startTimeLocal: text("start_time_local"),
  endTimeLocal: text("end_time_local"),
  timeMode: text("time_mode", { enum: ["untimed", "start_only", "range", "all_day", "opening_hours"] }).notNull().default("untimed"),
  openingHoursNote: text("opening_hours_note"),
  durationMinutes: integer("duration_minutes"),
  sortOrder: integer("sort_order").notNull(),
  lockedAt: text("locked_at"),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_itinerary_items_day_order").on(table.dayId, table.sortOrder),
  index("idx_itinerary_items_trip_day").on(table.tripId, table.dayId),
  index("idx_itinerary_items_recommendation").on(table.recommendationId),
  index("idx_itinerary_items_place").on(table.placeId),
]);

export const itineraryItemParticipantOverrideRecords = sqliteTable("itinerary_item_participant_overrides", {
  itineraryItemId: text("itinerary_item_id").notNull().references(() => itineraryItemRecords.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  participation: text("participation", { enum: ["included", "excluded"] }).notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.itineraryItemId, table.memberId] }),
  index("idx_itinerary_overrides_member").on(table.memberId),
]);

export const frameworkConstraintRecords = sqliteTable("framework_constraints", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  dayId: text("day_id").references(() => dayRecords.id, { onDelete: "restrict" }),
  stageId: text("stage_id").references(() => tripStageRecords.id, { onDelete: "restrict" }),
  bookingId: text("booking_id").references(() => bookingRecords.id, { onDelete: "restrict" }),
  constraintType: text("constraint_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  strength: text("strength", { enum: ["soft", "hard"] }).notNull(),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_framework_constraints_trip_day").on(table.tripId, table.dayId, table.deletedAt),
]);

/** A lightweight trip-level scratchpad. A saved place is not a recommendation,
 * an itinerary item, or a legacy trip_place; it is simply a place worth
 * looking at later. */
export const tripSavedPlaceRecords = sqliteTable("trip_saved_places", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  placeId: text("place_id").notNull().references(() => placeRecords.id, { onDelete: "restrict" }),
  createdByMemberId: text("created_by_member_id").notNull().references(() => memberRecords.id, { onDelete: "restrict" }),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_trip_saved_places_trip_place").on(table.tripId, table.placeId),
  index("idx_trip_saved_places_trip_created").on(table.tripId, table.createdAt),
]);

/** The user's chosen mode for a derived route segment. Route responses from
 * AMap remain ephemeral/cacheable and are deliberately not stored here. */
export const routePreferenceRecords = sqliteTable("route_preferences", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  dayId: text("day_id").notNull().references(() => dayRecords.id, { onDelete: "cascade" }),
  fromSource: text("from_source").notNull(),
  fromId: text("from_id").notNull(),
  toSource: text("to_source").notNull(),
  toId: text("to_id").notNull(),
  memberId: text("member_id").references(() => memberRecords.id, { onDelete: "restrict" }),
  preferredMode: text("preferred_mode", { enum: ["walking", "transit", "subway", "bus", "mixed_transit", "taxi", "bicycling"] }).notNull(),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_route_preferences_segment_member").on(table.tripId, table.dayId, table.fromSource, table.fromId, table.toSource, table.toId, table.memberId),
  index("idx_route_preferences_day").on(table.tripId, table.dayId),
]);

/** Placement for mixing immutable Booking facts with mutable itinerary items.
 * It stores only display order, never a copy of booking timing or amount. */
export const dayTimelinePositionRecords = sqliteTable("day_timeline_positions", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => tripRecords.id, { onDelete: "cascade" }),
  dayId: text("day_id").notNull().references(() => dayRecords.id, { onDelete: "cascade" }),
  sourceType: text("source_type", { enum: ["itinerary_item", "booking_anchor"] }).notNull(),
  sourceId: text("source_id").notNull(),
  anchorType: text("anchor_type", { enum: ["departure", "arrival", "hotel_checkin", "hotel_checkout", "stay", "other"] }),
  sortOrder: integer("sort_order").notNull(),
  createdByMemberId: text("created_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  updatedByMemberId: text("updated_by_member_id").references(() => memberRecords.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_day_timeline_position_source").on(table.dayId, table.sourceType, table.sourceId, table.anchorType),
  uniqueIndex("idx_day_timeline_position_order").on(table.dayId, table.sortOrder),
  index("idx_day_timeline_position_trip_day").on(table.tripId, table.dayId),
]);

export const dayPlaceRecords = sqliteTable("day_places", {
  dayId: text("day_id").notNull().references(() => dayRecords.id, { onDelete: "cascade" }),
  placeId: text("place_id").notNull().references(() => placeRecords.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull(),
  note: text("note"),
  arrivalTime: text("arrival_time"),
  departureTime: text("departure_time"),
}, (table) => [
  primaryKey({ columns: [table.dayId, table.placeId] }),
  uniqueIndex("idx_day_places_day_sort").on(table.dayId, table.sortOrder),
  index("idx_day_places_place").on(table.placeId),
]);
