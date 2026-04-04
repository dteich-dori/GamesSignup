import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { gameSlots } from "./gameSlots";
import { players } from "./players";

export const signups = sqliteTable("signups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameSlotId: integer("game_slot_id")
    .notNull()
    .references(() => gameSlots.id, { onDelete: "cascade" }),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  signedUpAt: text("signed_up_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  unique().on(table.gameSlotId, table.playerId),
]);
