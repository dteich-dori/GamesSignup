import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameSlots, signups, activityLog } from "@/db/schema";
import { lte, inArray } from "drizzle-orm";
import { sendGameReminders, sendUrgentIncompleteNotices } from "@/lib/reminders";

// Daily cron: send reminders, send urgent notices, then clean up old slots
// Runs at 23:00 UTC (7PM EDT / 6PM EST)
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const database = await db();
  const results: Record<string, unknown> = {};

  // 1. Send game reminders for tomorrow's complete games
  try {
    const reminderResult = await sendGameReminders(database);
    results.reminders = reminderResult;
  } catch (err) {
    results.reminders = { error: String(err) };
    await database.insert(activityLog).values({
      action: "CRON_ERROR",
      details: JSON.stringify({ step: "reminders", error: String(err) }),
    });
  }

  // 2. Send urgent notices for tomorrow's incomplete games
  try {
    const urgentResult = await sendUrgentIncompleteNotices(database);
    results.urgent = urgentResult;
  } catch (err) {
    results.urgent = { error: String(err) };
    await database.insert(activityLog).values({
      action: "CRON_ERROR",
      details: JSON.stringify({ step: "urgent", error: String(err) }),
    });
  }

  // 3. Clean up today's and older game slots
  try {
    const today = new Date().toISOString().split("T")[0];

    const slotsToDelete = await database
      .select({ id: gameSlots.id, date: gameSlots.date })
      .from(gameSlots)
      .where(lte(gameSlots.date, today));

    if (slotsToDelete.length > 0) {
      const slotIds = slotsToDelete.map((s) => s.id);
      const dates = slotsToDelete.map((s) => s.date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      await database.delete(signups).where(inArray(signups.gameSlotId, slotIds));
      await database.delete(gameSlots).where(lte(gameSlots.date, today));

      await database.insert(activityLog).values({
        action: "DELETE_GAMES",
        details: JSON.stringify({
          deleted: slotIds.length,
          fromDate: minDate,
          toDate: maxDate,
          source: "auto-cleanup",
        }),
      });

      results.cleanup = { deleted: slotIds.length, fromDate: minDate, toDate: maxDate };
    } else {
      results.cleanup = { deleted: 0, message: "No old slots to clean up" };
    }
  } catch (err) {
    results.cleanup = { error: String(err) };
    await database.insert(activityLog).values({
      action: "CRON_ERROR",
      details: JSON.stringify({ step: "cleanup", error: String(err) }),
    });
  }

  return NextResponse.json(results);
}
