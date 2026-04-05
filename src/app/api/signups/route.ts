import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { signups, gameSlots, players, activityLog, notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const { gameSlotId, playerId } = await request.json();

  if (!gameSlotId || !playerId) {
    return NextResponse.json({ error: "gameSlotId and playerId are required" }, { status: 400 });
  }

  const database = await db();

  // Check slot exists and isn't locked
  const [slot] = await database.select().from(gameSlots).where(eq(gameSlots.id, gameSlotId));
  if (!slot) {
    return NextResponse.json({ error: "Game slot not found" }, { status: 404 });
  }
  if (slot.isLocked) {
    return NextResponse.json({ error: "This game is locked" }, { status: 400 });
  }

  // Check if already full
  const currentSignups = await database.select().from(signups).where(eq(signups.gameSlotId, gameSlotId));
  if (currentSignups.length >= slot.maxPlayers) {
    return NextResponse.json({ error: "This game is full" }, { status: 400 });
  }

  // Check if player already signed up for this slot
  const existing = await database
    .select()
    .from(signups)
    .where(and(eq(signups.gameSlotId, gameSlotId), eq(signups.playerId, playerId)));
  if (existing.length > 0) {
    return NextResponse.json({ error: "Already signed up for this game" }, { status: 409 });
  }

  // Check if player already signed up for another game on the same date
  const sameDaySlots = await database
    .select({ id: gameSlots.id })
    .from(gameSlots)
    .where(eq(gameSlots.date, slot.date));
  const sameDaySlotIds = sameDaySlots.map((s) => s.id);

  for (const slotId of sameDaySlotIds) {
    const alreadyOnDay = await database
      .select()
      .from(signups)
      .where(and(eq(signups.gameSlotId, slotId), eq(signups.playerId, playerId)));
    if (alreadyOnDay.length > 0) {
      return NextResponse.json({ error: "You are already signed up for another game on this day" }, { status: 409 });
    }
  }

  // Get player name for logging
  const [player] = await database.select().from(players).where(eq(players.id, playerId));

  const [created] = await database.insert(signups).values({
    gameSlotId,
    playerId,
  }).returning();

  // Log the action
  await database.insert(activityLog).values({
    action: "JOIN",
    playerId,
    gameSlotId,
    details: JSON.stringify({
      playerName: player?.name,
      date: slot.date,
      court: slot.courtNumber,
    }),
  });

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameSlotId = Number(searchParams.get("gameSlotId"));
  const playerId = Number(searchParams.get("playerId"));

  if (!gameSlotId || !playerId) {
    return NextResponse.json({ error: "gameSlotId and playerId are required" }, { status: 400 });
  }

  const database = await db();

  // Check slot
  const [slot] = await database.select().from(gameSlots).where(eq(gameSlots.id, gameSlotId));
  if (!slot) {
    return NextResponse.json({ error: "Game slot not found" }, { status: 404 });
  }

  // Check current signups to determine if game was full before withdrawal
  const currentSignups = await database
    .select({ playerId: signups.playerId })
    .from(signups)
    .where(eq(signups.gameSlotId, gameSlotId));

  const wasFull = currentSignups.length >= slot.maxPlayers;

  // Delete the signup
  await database
    .delete(signups)
    .where(and(eq(signups.gameSlotId, gameSlotId), eq(signups.playerId, playerId)));

  // Get player name for logging
  const [player] = await database.select().from(players).where(eq(players.id, playerId));

  // Log the action
  await database.insert(activityLog).values({
    action: "WITHDRAW",
    playerId,
    gameSlotId,
    details: JSON.stringify({
      playerName: player?.name,
      date: slot.date,
      court: slot.courtNumber,
      wasFull,
    }),
  });

  // If game was full, notify the other players
  if (wasFull) {
    const remainingPlayerIds = currentSignups
      .map((s) => s.playerId)
      .filter((id) => id !== playerId);

    for (const rpId of remainingPlayerIds) {
      await database.insert(notifications).values({
        playerId: rpId,
        type: "CANCELLATION",
        message: `${player?.name || "A player"} withdrew from Court ${slot.courtNumber} on ${slot.date}. The game now needs a 4th player.`,
      });
    }

    // TODO: Send email notifications via Resend
  }

  return NextResponse.json({ success: true });
}
