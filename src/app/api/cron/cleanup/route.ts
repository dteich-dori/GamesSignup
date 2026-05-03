import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameSlots, signups, activityLog, settings, gameStats } from "@/db/schema";
import { eq, lte, inArray, sql, count } from "drizzle-orm";
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

      // Snapshot game completion stats before deleting
      try {
        const slotCounts = await database
          .select({
            slotId: gameSlots.id,
            signupCount: count(signups.id),
          })
          .from(gameSlots)
          .leftJoin(signups, eq(gameSlots.id, signups.gameSlotId))
          .where(inArray(gameSlots.id, slotIds))
          .groupBy(gameSlots.id);

        const buckets = { g0: 0, g1: 0, g2: 0, g3: 0, g4: 0 };
        for (const row of slotCounts) {
          const n = Math.min(row.signupCount, 4);
          if (n === 0) buckets.g0++;
          else if (n === 1) buckets.g1++;
          else if (n === 2) buckets.g2++;
          else if (n === 3) buckets.g3++;
          else buckets.g4++;
        }

        await database
          .update(gameStats)
          .set({
            games0: sql`${gameStats.games0} + ${buckets.g0}`,
            games1: sql`${gameStats.games1} + ${buckets.g1}`,
            games2: sql`${gameStats.games2} + ${buckets.g2}`,
            games3: sql`${gameStats.games3} + ${buckets.g3}`,
            games4: sql`${gameStats.games4} + ${buckets.g4}`,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(gameStats.id, 1));

        results.gameStats = buckets;
      } catch (statsErr) {
        results.gameStats = { error: String(statsErr) };
      }

      // Count signups before deleting so the log shows real player events removed
      const signupsToDelete = await database
        .select({ id: signups.id })
        .from(signups)
        .where(inArray(signups.gameSlotId, slotIds));
      const signupsCount = signupsToDelete.length;

      await database.delete(signups).where(inArray(signups.gameSlotId, slotIds));
      await database.delete(gameSlots).where(lte(gameSlots.date, today));

      await database.insert(activityLog).values({
        action: "DELETE_GAMES",
        details: JSON.stringify({
          deleted: slotIds.length,
          signupsDeleted: signupsCount,
          fromDate: minDate,
          toDate: maxDate,
          source: "auto-cleanup",
        }),
      });

      // Shift start date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      await database
        .update(settings)
        .set({ startDate: tomorrowStr })
        .where(eq(settings.id, 1));

      results.cleanup = { deleted: slotIds.length, fromDate: minDate, toDate: maxDate, newStartDate: tomorrowStr };
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
