import { NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameSlots, signups, settings, activityLog } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/game-slots/reset-overflow
 * Immediately removes all empty overflow slots and resets the overflow timer.
 */
export async function POST() {
  const database = await db();

  const overflowSlots = await database
    .select()
    .from(gameSlots)
    .where(eq(gameSlots.isOverflow, true));

  let removed = 0;
  for (const slot of overflowSlots) {
    const slotSignups = await database
      .select()
      .from(signups)
      .where(eq(signups.gameSlotId, slot.id));
    if (slotSignups.length === 0) {
      await database.delete(gameSlots).where(eq(gameSlots.id, slot.id));
      removed++;
    }
  }

  // Reset the overflow tracking date
  await database.update(settings).set({ overflowLastSignupDate: null });

  if (removed > 0) {
    await database.insert(activityLog).values({
      action: "OVERFLOW_RESET",
      details: JSON.stringify({
        slotsRemoved: removed,
        reason: "Manual reset from Setup",
      }),
    });
  }

  return NextResponse.json({ removed });
}
