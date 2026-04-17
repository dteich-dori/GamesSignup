import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const gameStats = sqliteTable("game_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  games0: integer("games_0").notNull().default(0),
  games1: integer("games_1").notNull().default(0),
  games2: integer("games_2").notNull().default(0),
  games3: integer("games_3").notNull().default(0),
  games4: integer("games_4").notNull().default(0),
  lastUpdated: text("last_updated").notNull().default(sql`(datetime('now'))`),
});
