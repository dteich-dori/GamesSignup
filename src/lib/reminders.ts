import { eq } from "drizzle-orm";
import { gameSlots, signups, players, notifications, settings, emailLog } from "@/db/schema";
import { sendBulkEmails, validateResendKey, type Recipient } from "./email";
import type { Database } from "@/db/index";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Send reminder emails to all players signed up for tomorrow's complete games.
 * Also creates in-app notifications.
 */
export async function sendGameReminders(database: Database) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const settingsRows = await database.select().from(settings);
  const s = settingsRows[0];
  if (!s) return { remindersSent: 0, emailsSent: 0 };

  const tomorrowSlots = await database
    .select()
    .from(gameSlots)
    .where(eq(gameSlots.date, tomorrowStr));

  let remindersSent = 0;
  let emailsSent = 0;

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
    const message = `Reminder: You have a game tomorrow (${tomorrowStr}) on Court ${slot.courtNumber} at ${slot.timeSlot}. Players: ${playerNames}`;

    // Create in-app notifications
    for (const signup of slotSignups) {
      await database.insert(notifications).values({
        playerId: signup.playerId,
        type: "REMINDER",
        message,
      });
      remindersSent++;
    }

    // Send emails if Resend is configured
    if (!validateResendKey()) {
      const recipients: Recipient[] = slotSignups
        .filter((s) => s.playerEmail)
        .map((s) => ({ name: s.playerName, email: s.playerEmail! }));

      if (recipients.length > 0) {
        const result = await sendBulkEmails(
          recipients,
          `Game Reminder: ${tomorrowStr} Court ${slot.courtNumber}`,
          message,
          s.emailFromName,
          s.emailReplyTo || undefined
        );
        emailsSent += result.sent;

        // Log to email log
        if (result.sent > 0) {
          await database.insert(emailLog).values({
            subject: `Game Reminder: ${tomorrowStr} Court ${slot.courtNumber}`,
            body: message,
            recipientGroup: "REMINDER",
            recipientCount: result.sent,
            recipientList: result.recipients.join(", "),
            fromName: s.emailFromName,
            replyTo: s.emailReplyTo,
          });
        }
      }
    }
  }

  return { remindersSent, emailsSent };
}

/**
 * Send urgent emails for tomorrow's incomplete games (fewer than maxPlayers).
 * Only sends to players already signed up.
 */
export async function sendUrgentIncompleteNotices(database: Database) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const settingsRows = await database.select().from(settings);
  const s = settingsRows[0];
  if (!s) return { urgentNoticesSent: 0 };

  if (validateResendKey()) {
    // Resend not configured — skip silently
    return { urgentNoticesSent: 0 };
  }

  const tomorrowSlots = await database
    .select()
    .from(gameSlots)
    .where(eq(gameSlots.date, tomorrowStr));

  let urgentNoticesSent = 0;

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

    // Only send for incomplete games that have at least 1 player
    if (slotSignups.length === 0 || slotSignups.length >= slot.maxPlayers) continue;

    const playerNames = slotSignups.map((s) => s.playerName).join(", ");
    const message = `URGENT: Tomorrow's game (${tomorrowStr}) on Court ${slot.courtNumber} at ${slot.timeSlot} needs more players!\n\nCurrently signed up (${slotSignups.length}/${slot.maxPlayers}): ${playerNames}\n\nPlease help find additional players.`;

    // Create in-app notifications
    for (const signup of slotSignups) {
      await database.insert(notifications).values({
        playerId: signup.playerId,
        type: "REMINDER",
        message: `URGENT: Tomorrow's game on Court ${slot.courtNumber} needs more players! (${slotSignups.length}/${slot.maxPlayers})`,
      });
    }

    // Send emails
    const recipients: Recipient[] = slotSignups
      .filter((s) => s.playerEmail)
      .map((s) => ({ name: s.playerName, email: s.playerEmail! }));

    if (recipients.length > 0) {
      const result = await sendBulkEmails(
        recipients,
        `URGENT: Tomorrow's game needs players - Court ${slot.courtNumber}`,
        message,
        s.emailFromName,
        s.emailReplyTo || undefined
      );
      urgentNoticesSent += result.sent;

      if (result.sent > 0) {
        await database.insert(emailLog).values({
          subject: `URGENT: Tomorrow's game needs players - Court ${slot.courtNumber}`,
          body: message,
          recipientGroup: "URGENT",
          recipientCount: result.sent,
          recipientList: result.recipients.join(", "),
          fromName: s.emailFromName,
          replyTo: s.emailReplyTo,
        });
      }
    }
  }

  return { urgentNoticesSent };
}
