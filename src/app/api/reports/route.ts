import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { signups, players, gameSlots, activityLog } from "@/db/schema";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type") || "player-frequency";

  const database = await db();

  if (type === "player-frequency") {
    // Games per player
    const conditions = [];
    if (from) conditions.push(gte(gameSlots.date, from));
    if (to) conditions.push(lte(gameSlots.date, to));

    const results = await database
      .select({
        playerId: signups.playerId,
        playerName: players.name,
        gameCount: count(signups.id),
      })
      .from(signups)
      .innerJoin(players, eq(signups.playerId, players.id))
      .innerJoin(gameSlots, eq(signups.gameSlotId, gameSlots.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(signups.playerId, players.name)
      .orderBy(sql`count(${signups.id}) DESC`);

    return NextResponse.json(results);
  }

  if (type === "cancellation-rate") {
    // Withdrawals per player
    const conditions = [eq(activityLog.action, "WITHDRAW")];
    if (from) conditions.push(gte(activityLog.createdAt, from));
    if (to) conditions.push(lte(activityLog.createdAt, to));

    const results = await database
      .select({
        playerId: activityLog.playerId,
        playerName: players.name,
        cancellations: count(activityLog.id),
      })
      .from(activityLog)
      .leftJoin(players, eq(activityLog.playerId, players.id))
      .where(and(...conditions))
      .groupBy(activityLog.playerId, players.name)
      .orderBy(sql`count(${activityLog.id}) DESC`);

    return NextResponse.json(results);
  }

  if (type === "court-utilization") {
    // Signups per court per day
    const conditions = [];
    if (from) conditions.push(gte(gameSlots.date, from));
    if (to) conditions.push(lte(gameSlots.date, to));

    const results = await database
      .select({
        date: gameSlots.date,
        courtNumber: gameSlots.courtNumber,
        signupCount: count(signups.id),
        maxPlayers: gameSlots.maxPlayers,
      })
      .from(gameSlots)
      .leftJoin(signups, eq(gameSlots.id, signups.gameSlotId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(gameSlots.date, gameSlots.courtNumber, gameSlots.maxPlayers)
      .orderBy(gameSlots.date, gameSlots.courtNumber);

    return NextResponse.json(results);
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
