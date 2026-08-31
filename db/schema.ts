import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const memberRecords = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("idx_members_name").on(table.name)]);

export const tripRecords = sqliteTable("trips", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["inspiration", "planning", "completed"] }).notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  people: integer("people").notNull().default(1),
  cover: text("cover"),
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
}, (table) => [
  primaryKey({ columns: [table.tripId, table.memberId] }),
  index("idx_trip_members_member").on(table.memberId),
]);

export const cityRecords = sqliteTable("cities", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
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
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.tripId, table.placeId] }), index("idx_trip_places_place").on(table.placeId)]);

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
}, (table) => [
  uniqueIndex("idx_days_trip_day_number").on(table.tripId, table.dayNumber),
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
