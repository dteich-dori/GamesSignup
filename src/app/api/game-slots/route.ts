import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameSlots, settings, signups, players, activityLog } from "@/db/schema";
import { eq, and, gte, lte, lt, gt, asc, inArray } from "drizzle-orm";

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

    // Add missing courts
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

    // Remove excess courts (only if they have no signups and are NOT overflow slots)
    const excessSlots = existing.filter((g) => g.courtNumber > s.courtsAvailable && !g.isOverflow);
    for (const slot of excessSlots) {
      const slotSignups = await database
        .select()
        .from(signups)
        .where(eq(signups.gameSlotId, slot.id));
      if (slotSignups.length === 0) {
        await database.delete(gameSlots).where(eq(gameSlots.id, slot.id));
      }
    }
  }
}

/**
 * Check if overflow slots should be reverted.
 * If overflowLastSignupDate is null or > 14 days ago, delete all empty overflow slots.
 */
async function checkOverflowRevert(database: Awaited<ReturnType<typeof db>>) {
  // Check if any overflow slots exist at all
  const overflowSlots = await database
    .select()
    .from(gameSlots)
    .where(eq(gameSlots.isOverflow, true));

  if (overflowSlots.length === 0) return;

  const settingsRows = await database.select().from(settings);
  if (settingsRows.length === 0) return;
  const s = settingsRows[0];

  const lastSignup = s.overflowLastSignupDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let shouldRevert = false;
  if (!lastSignup) {
    // No one has ever signed up for an overflow slot — check if slots are older than 14 days
    // Use the earliest overflow slot date as the baseline
    const earliest = overflowSlots.reduce((min, sl) => sl.date < min ? sl.date : min, overflowSlots[0].date);
    const earliestDate = new Date(earliest + "T00:00:00");
    const daysSince = Math.floor((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
    shouldRevert = daysSince >= 14;
  } else {
    const lastDate = new Date(lastSignup + "T00:00:00");
    const daysSince = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    shouldRevert = daysSince >= 14;
  }

  if (!shouldRevert) return;

  // Delete empty overflow slots only
  let deletedCount = 0;
  for (const slot of overflowSlots) {
    const slotSignups = await database
      .select()
      .from(signups)
      .where(eq(signups.gameSlotId, slot.id));
    if (slotSignups.length === 0) {
      await database.delete(gameSlots).where(eq(gameSlots.id, slot.id));
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    await database.update(settings).set({ overflowLastSignupDate: null });
    await database.insert(activityLog).values({
      action: "OVERFLOW_DEACTIVATED",
      details: JSON.stringify({
        slotsRemoved: deletedCount,
        reason: "No overflow signups for 14+ days",
      }),
    });
  }
}

export async function GET(request: NextRequest) {
  const database = await db();
  const { searchParams } = new URL(request.url);
  const generate = searchParams.get("generate");
  const checkExcess = searchParams.get("checkExcess");

  // Check if reducing courts would affect slots with signups
  if (checkExcess) {
    const maxCourt = Number(checkExcess);
    const excessSlots = await database
      .select({ id: gameSlots.id, date: gameSlots.date, courtNumber: gameSlots.courtNumber })
      .from(gameSlots)
      .where(gt(gameSlots.courtNumber, maxCourt));

    let slotsWithSignups = 0;
    for (const slot of excessSlots) {
      const count = await database
        .select()
        .from(signups)
        .where(eq(signups.gameSlotId, slot.id));
      if (count.length > 0) slotsWithSignups++;
    }

    return NextResponse.json({
      excessSlots: excessSlots.length,
      slotsWithSignups,
    });
  }

  if (generate === "true") {
    await autoGenerateSlots(database);
    await checkOverflowRevert(database);
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
  const { fromDate, toDate, source } = body;

  // Support legacy "beforeDate" param
  const beforeDate = body.beforeDate;

  const database = await db();

  // Build date conditions
  const conditions = [];
  if (beforeDate) {
    conditions.push(lt(gameSlots.date, beforeDate));
  } else {
    if (fromDate) conditions.push(gte(gameSlots.date, fromDate));
    if (toDate) conditions.push(lte(gameSlots.date, toDate));
  }

  if (conditions.length === 0) {
    return NextResponse.json({ error: "Date range is required" }, { status: 400 });
  }

  // Find slots to delete and their date range
  const slotsToDelete = await database
    .select({ id: gameSlots.id, date: gameSlots.date })
    .from(gameSlots)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions));

  if (slotsToDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const slotIds = slotsToDelete.map((s) => s.id);
  const dates = slotsToDelete.map((s) => s.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  // Delete signups for those slots first
  await database.delete(signups).where(inArray(signups.gameSlotId, slotIds));

  // Delete the game slots
  if (beforeDate) {
    await database.delete(gameSlots).where(lt(gameSlots.date, beforeDate));
  } else {
    await database.delete(gameSlots).where(
      conditions.length === 1 ? conditions[0] : and(...conditions)
    );
  }

  // Log the deletion
  await database.insert(activityLog).values({
    action: "DELETE_GAMES",
    details: JSON.stringify({
      deleted: slotIds.length,
      fromDate: minDate,
      toDate: maxDate,
      source: source || "manual",
    }),
  });

  return NextResponse.json({ deleted: slotIds.length, fromDate: minDate, toDate: maxDate });
}
