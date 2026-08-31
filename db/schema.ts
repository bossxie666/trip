import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
}, (table) => [
  uniqueIndex("idx_trips_slug").on(table.slug),
  index("idx_trips_status_created").on(table.status, table.createdAt),
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
