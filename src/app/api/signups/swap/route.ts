import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { signups, gameSlots, players, activityLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const { playerId, fromGameSlotId, toGameSlotId } = await request.json();

  if (!playerId || !fromGameSlotId || !toGameSlotId) {
    return NextResponse.json(
      { error: "playerId, fromGameSlotId, and toGameSlotId are required" },
      { status: 400 }
    );
  }

  const database = await db();

  // Verify both slots exist
  const [fromSlot] = await database.select().from(gameSlots).where(eq(gameSlots.id, fromGameSlotId));
  const [toSlot] = await database.select().from(gameSlots).where(eq(gameSlots.id, toGameSlotId));

  if (!fromSlot || !toSlot) {
    return NextResponse.json({ error: "Game slot not found" }, { status: 404 });
  }

  // Check player is in the from slot
  const [existingSignup] = await database
    .select()
    .from(signups)
    .where(and(eq(signups.gameSlotId, fromGameSlotId), eq(signups.playerId, playerId)));

  if (!existingSignup) {
    return NextResponse.json({ error: "Player is not signed up for the source game" }, { status: 400 });
  }

  // Check to slot has room
  const toSignups = await database.select().from(signups).where(eq(signups.gameSlotId, toGameSlotId));
  if (toSignups.length >= toSlot.maxPlayers) {
    return NextResponse.json({ error: "Target game is full" }, { status: 400 });
  }

  // Check player isn't already in target
  const alreadyInTarget = toSignups.some((s) => s.playerId === playerId);
  if (alreadyInTarget) {
    return NextResponse.json({ error: "Already signed up for target game" }, { status: 409 });
  }

  // Perform the swap: delete from source, insert into target
  await database
    .delete(signups)
    .where(and(eq(signups.gameSlotId, fromGameSlotId), eq(signups.playerId, playerId)));

  await database.insert(signups).values({
    gameSlotId: toGameSlotId,
    playerId,
  });

  // Get player name for logging
  const [player] = await database.select().from(players).where(eq(players.id, playerId));

  // Log the swap
  await database.insert(activityLog).values({
    action: "SWAP",
    playerId,
    gameSlotId: toGameSlotId,
    details: JSON.stringify({
      playerName: player?.name,
      fromDate: fromSlot.date,
      fromCourt: fromSlot.courtNumber,
      toDate: toSlot.date,
      toCourt: toSlot.courtNumber,
    }),
  });

  return NextResponse.json({ success: true });
}
