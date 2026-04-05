import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameSlots, signups } from "@/db/schema";
import { eq, lte, inArray } from "drizzle-orm";

// Auto-delete today's (and older) game slots
// Called by Vercel cron after all games are done for the day
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const database = await db();

  // Delete all slots for today and earlier (games are done)
  const today = new Date().toISOString().split("T")[0];

  const slotsToDelete = await database
    .select({ id: gameSlots.id })
    .from(gameSlots)
    .where(lte(gameSlots.date, today));

  if (slotsToDelete.length === 0) {
    return NextResponse.json({ deleted: 0, message: "No old slots to clean up" });
  }

  const slotIds = slotsToDelete.map((s) => s.id);

  // Delete signups first, then slots
  await database.delete(signups).where(inArray(signups.gameSlotId, slotIds));
  await database.delete(gameSlots).where(lte(gameSlots.date, today));

  return NextResponse.json({
    deleted: slotIds.length,
    message: `Cleaned up ${slotIds.length} game slot(s) for ${today} and earlier`,
  });
}
