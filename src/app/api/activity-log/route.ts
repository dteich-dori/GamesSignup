import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { activityLog, players, gameSlots } from "@/db/schema";
import { eq, desc, and, gte, lte, lt, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const action = searchParams.get("action");
  const playerId = searchParams.get("playerId");
  const limit = Number(searchParams.get("limit")) || 100;

  const database = await db();

  const conditions = [];
  if (from) conditions.push(gte(activityLog.createdAt, from));
  if (to) conditions.push(lte(activityLog.createdAt, to));
  if (action) conditions.push(eq(activityLog.action, action));
  if (playerId) conditions.push(eq(activityLog.playerId, Number(playerId)));

  const logs = await database
    .select({
      id: activityLog.id,
      action: activityLog.action,
      playerId: activityLog.playerId,
      playerName: players.name,
      gameSlotId: activityLog.gameSlotId,
      details: activityLog.details,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .leftJoin(players, eq(activityLog.playerId, players.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  return NextResponse.json(logs);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const before = searchParams.get("before"); // ISO date — delete entries older than this
  const all = searchParams.get("all"); // "true" — delete everything

  const database = await db();

  // Single delete by ID
  if (id) {
    await database.delete(activityLog).where(eq(activityLog.id, Number(id)));
    return NextResponse.json({ deleted: 1 });
  }

  // Fetch all IDs we want to delete, then delete by ID list (more reliable than WHERE clause on text date)
  let idsToDelete: number[] = [];

  if (all === "true") {
    const rows = await database.select({ id: activityLog.id }).from(activityLog);
    idsToDelete = rows.map((r) => r.id);
  } else if (before) {
    const cutoff = `${before}T00:00:00.000Z`;
    const rows = await database
      .select({ id: activityLog.id, createdAt: activityLog.createdAt })
      .from(activityLog);
    idsToDelete = rows.filter((r) => r.createdAt < cutoff).map((r) => r.id);
  } else {
    return NextResponse.json({ error: "Specify id, before, or all=true" }, { status: 400 });
  }

  if (idsToDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  // Delete in chunks of 500 to avoid SQL parameter limits
  let totalDeleted = 0;
  for (let i = 0; i < idsToDelete.length; i += 500) {
    const chunk = idsToDelete.slice(i, i + 500);
    await database.delete(activityLog).where(inArray(activityLog.id, chunk));
    totalDeleted += chunk.length;
  }

  return NextResponse.json({ deleted: totalDeleted });
}
