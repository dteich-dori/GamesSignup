import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { players } from "./players";
import { gameSlots } from "./gameSlots";

export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(), // JOIN, WITHDRAW, SWAP, SETTINGS_CHANGE, PLAYER_ADD, etc.
  playerId: integer("player_id").references(() => players.id, { onDelete: "set null" }),
  gameSlotId: integer("game_slot_id").references(() => gameSlots.id, { onDelete: "set null" }),
  details: text("details"), // JSON string with extra context
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
