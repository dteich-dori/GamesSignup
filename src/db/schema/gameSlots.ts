import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const gameSlots = sqliteTable("game_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  courtNumber: integer("court_number").notNull(),
  timeSlot: text("time_slot").notNull(),
  maxPlayers: integer("max_players").notNull().default(4),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  reservedCourt: text("reserved_court"),
  isOverflow: integer("is_overflow", { mode: "boolean" }).notNull().default(false),
});
