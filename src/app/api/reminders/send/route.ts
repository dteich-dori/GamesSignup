import { NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameSlots, signups, players, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function POST() {
  const database = await db();

  // Find tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  // Get all slots for tomorrow
  const tomorrowSlots = await database
    .select()
    .from(gameSlots)
    .where(eq(gameSlots.date, tomorrowStr));

  let remindersSent = 0;

  for (const slot of tomorrowSlots) {
    const slotSignups = await database
      .select({
        playerId: signups.playerId,
        playerName: players.name,
        playerEmail: players.email,
      })
      .from(signups)
      .innerJoin(players, eq(signups.playerId, players.id))
      .where(eq(signups.gameSlotId, slot.id));

    // Only send reminders for complete games
    if (slotSignups.length < slot.maxPlayers) continue;

    const playerNames = slotSignups.map((s) => s.playerName).join(", ");

    for (const signup of slotSignups) {
      // Create in-app notification
      await database.insert(notifications).values({
        playerId: signup.playerId,
        type: "REMINDER",
        message: `Reminder: You have a game tomorrow (${tomorrowStr}) on Court ${slot.courtNumber} at ${slot.timeSlot}. Players: ${playerNames}`,
      });

      // TODO: Send email via Resend if player has email
      remindersSent++;
    }
  }

  return NextResponse.json({ remindersSent, date: tomorrowStr });
}
