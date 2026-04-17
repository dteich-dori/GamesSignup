import { NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameStats } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * GET /api/migrate/game-stats
 * Creates the game_stats table and inserts the initial row.
 * Safe to call multiple times — skips if table/row already exists.
 */
export async function GET() {
  try {
    const database = await db();

    // Create table if not exists
    await database.run(sql`
      CREATE TABLE IF NOT EXISTS game_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        games_0 INTEGER NOT NULL DEFAULT 0,
        games_1 INTEGER NOT NULL DEFAULT 0,
        games_2 INTEGER NOT NULL DEFAULT 0,
        games_3 INTEGER NOT NULL DEFAULT 0,
        games_4 INTEGER NOT NULL DEFAULT 0,
        last_updated TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Insert initial row if empty
    const existing = await database.select().from(gameStats);
    if (existing.length === 0) {
      await database.insert(gameStats).values({});
    }

    return NextResponse.json({ success: true, message: "game_stats table ready" });
  } catch (err) {
    console.error("[migrate/game-stats] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
