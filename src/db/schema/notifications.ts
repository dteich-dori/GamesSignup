import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { players } from "./players";

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // CANCELLATION, REMINDER, ERROR, SWAP
  message: text("message").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  emailSent: integer("email_sent", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
