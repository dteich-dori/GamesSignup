import { NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { gameSlots, signups, players, settings } from "@/db/schema";
import { eq } from "drizzle-orm";

// Dry-run test endpoint — shows what the cron WOULD do without sending or deleting anything
export async function GET() {
  const database = await db();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const today = new Date().toISOString().split("T")[0];

  const settingsRows = await database.select().from(settings);
  const s = settingsRows[0];

  // Check tomorrow's slots
  const tomorrowSlots = await database
    .select()
    .from(gameSlots)
    .where(eq(gameSlots.date, tomorrowStr));

  const slotDetails = [];
  for (const slot of tomorrowSlots) {
    const slotSignups = await database
      .select({
        playerName: players.name,
        playerEmail: players.email,
        playerPhone: players.phone,
        playerCarrier: players.carrier,
      })
      .from(signups)
      .innerJoin(players, eq(signups.playerId, players.id))
      .where(eq(signups.gameSlotId, slot.id));

    const isComplete = slotSignups.length >= slot.maxPlayers;
    const isIncomplete = slotSignups.length > 0 && slotSignups.length < slot.maxPlayers;

    slotDetails.push({
      court: slot.courtNumber,
      time: slot.timeSlot,
      players: slotSignups.map((p) => ({
        name: p.playerName,
        hasEmail: !!p.playerEmail,
        hasSms: !!(p.playerPhone && p.playerCarrier),
      })),
      signupCount: `${slotSignups.length}/${slot.maxPlayers}`,
      status: isComplete ? "COMPLETE → would send REMINDER" :
              isIncomplete ? "INCOMPLETE → would send URGENT notice" :
              "EMPTY → no action",
    });
  }

  // Check what would be cleaned up
  const allSlots = await database.select().from(gameSlots);
  const oldSlots = allSlots.filter((s) => s.date <= today);

  return NextResponse.json({
    testDate: today,
    tomorrowDate: tomorrowStr,
    emailConfig: {
      gmailUser: process.env.GMAIL_USER ? "configured" : "NOT SET",
      gmailPassword: process.env.GMAIL_APP_PASSWORD ? "configured" : "NOT SET",
      fromName: s?.emailFromName || "NOT SET",
      replyTo: s?.emailReplyTo || "NOT SET",
    },
    tomorrowGames: slotDetails,
    cleanup: {
      wouldDelete: `${oldSlots.length} slot(s) on or before ${today}`,
      dates: [...new Set(oldSlots.map((s) => s.date))].sort(),
    },
    note: "This is a DRY RUN — nothing was sent or deleted",
  });
}
