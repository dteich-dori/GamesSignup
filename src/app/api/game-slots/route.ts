import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameSlots, settings, signups, players } from "@/db/schema";
import { eq, and, gte, lte, lt, asc, inArray } from "drizzle-orm";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function autoGenerateSlots(database: Awaited<ReturnType<typeof db>>) {
  const settingsRows = await database.select().from(settings);
  if (settingsRows.length === 0) return;

  const s = settingsRows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d <= s.daysAhead; d++) {
    const date = formatDate(addDays(today, d));

    const existing = await database
      .select()
      .from(gameSlots)
      .where(eq(gameSlots.date, date));

    const existingCourts = new Set(existing.map((g) => g.courtNumber));

    for (let court = 1; court <= s.courtsAvailable; court++) {
      if (!existingCourts.has(court)) {
        await database.insert(gameSlots).values({
          date,
          courtNumber: court,
          timeSlot: s.defaultTimeSlot,
          maxPlayers: s.playersPerGame,
        });
      }
    }
  }
}

export async function GET(request: NextRequest) {
  const database = await db();
  const { searchParams } = new URL(request.url);
  const generate = searchParams.get("generate");

  if (generate === "true") {
    await autoGenerateSlots(database);
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const today = formatDate(new Date());
  const settingsRows = await database.select().from(settings);
  const daysAhead = settingsRows[0]?.daysAhead ?? 10;
  const endDate = formatDate(addDays(new Date(), daysAhead));

  const fromDate = from || today;
  const toDate = to || endDate;

  const slots = await database
    .select()
    .from(gameSlots)
    .where(and(gte(gameSlots.date, fromDate), lte(gameSlots.date, toDate)))
    .orderBy(asc(gameSlots.date), asc(gameSlots.courtNumber));

  // Fetch signups for all these slots
  const slotIds = slots.map((s) => s.id);

  if (slotIds.length === 0) {
    return NextResponse.json([]);
  }

  const allSignups = await database
    .select({
      signupId: signups.id,
      gameSlotId: signups.gameSlotId,
      playerId: signups.playerId,
      playerName: players.name,
      signedUpAt: signups.signedUpAt,
    })
    .from(signups)
    .innerJoin(players, eq(signups.playerId, players.id));

  // Group signups by game slot
  const signupsBySlot = new Map<number, Array<{ id: number; playerId: number; playerName: string; signedUpAt: string }>>();
  for (const s of allSignups) {
    if (!signupsBySlot.has(s.gameSlotId)) {
      signupsBySlot.set(s.gameSlotId, []);
    }
    signupsBySlot.get(s.gameSlotId)!.push({
      id: s.signupId,
      playerId: s.playerId,
      playerName: s.playerName,
      signedUpAt: s.signedUpAt,
    });
  }

  const result = slots.map((slot) => ({
    ...slot,
    signups: signupsBySlot.get(slot.id) || [],
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, courtNumber, timeSlot, maxPlayers } = body;

  if (!date || !courtNumber) {
    return NextResponse.json({ error: "Date and court number are required" }, { status: 400 });
  }

  const database = await db();
  const settingsRows = await database.select().from(settings);
  const s = settingsRows[0];

  const [created] = await database.insert(gameSlots).values({
    date,
    courtNumber,
    timeSlot: timeSlot || s?.defaultTimeSlot || "8:00 AM - 10:00 AM",
    maxPlayers: maxPlayers || s?.playersPerGame || 4,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if ("timeSlot" in body) updateData.timeSlot = body.timeSlot;
  if ("reservedCourt" in body) updateData.reservedCourt = body.reservedCourt;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const database = await db();

  const [updated] = await database
    .update(gameSlots)
    .set(updateData)
    .where(eq(gameSlots.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { beforeDate } = body;

  if (!beforeDate) {
    return NextResponse.json({ error: "beforeDate is required" }, { status: 400 });
  }

  const database = await db();

  // Find slots to delete
  const slotsToDelete = await database
    .select({ id: gameSlots.id })
    .from(gameSlots)
    .where(lt(gameSlots.date, beforeDate));

  if (slotsToDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const slotIds = slotsToDelete.map((s) => s.id);

  // Delete signups for those slots first
  await database.delete(signups).where(inArray(signups.gameSlotId, slotIds));

  // Delete the game slots
  await database.delete(gameSlots).where(lt(gameSlots.date, beforeDate));

  return NextResponse.json({ deleted: slotIds.length });
}
