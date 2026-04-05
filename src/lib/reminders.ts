import { eq } from "drizzle-orm";
import { gameSlots, signups, players, notifications, settings, emailLog } from "@/db/schema";
import { sendBulkEmails, sendBulkSms, validateEmailConfig, type Recipient, type SmsRecipient } from "./email";
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
  let smsSent = 0;

  for (const slot of tomorrowSlots) {
    const slotSignups = await database
      .select({
        playerId: signups.playerId,
        playerName: players.name,
        playerEmail: players.email,
        playerPhone: players.phone,
        playerCarrier: players.carrier,
      })
      .from(signups)
      .innerJoin(players, eq(signups.playerId, players.id))
      .where(eq(signups.gameSlotId, slot.id));

    // Only send reminders for complete games
    if (slotSignups.length < slot.maxPlayers) continue;

    const playerNames = slotSignups.map((s) => s.playerName).join(", ");
    const message = `Reminder: You have a game tomorrow (${tomorrowStr}) on Court ${slot.courtNumber} at ${slot.timeSlot}. Players: ${playerNames}`;
    const subjectLine = `Game Reminder: ${tomorrowStr} Court ${slot.courtNumber}`;

    // Create in-app notifications
    for (const signup of slotSignups) {
      await database.insert(notifications).values({
        playerId: signup.playerId,
        type: "REMINDER",
        message,
      });
      remindersSent++;
    }

    // Send emails and SMS if Resend is configured
    if (!validateEmailConfig()) {
      const emailRecipients: Recipient[] = slotSignups
        .filter((s) => s.playerEmail)
        .map((s) => ({ name: s.playerName, email: s.playerEmail! }));

      const smsRecipients: SmsRecipient[] = slotSignups
        .filter((s) => s.playerPhone && s.playerCarrier)
        .map((s) => ({ name: s.playerName, phone: s.playerPhone!, carrier: s.playerCarrier! }));

      const allRecipientNames: string[] = [];

      if (emailRecipients.length > 0) {
        const result = await sendBulkEmails(emailRecipients, subjectLine, message, s.emailFromName, s.emailReplyTo || undefined);
        emailsSent += result.sent;
        allRecipientNames.push(...result.recipients);
      }

      if (smsRecipients.length > 0) {
        const result = await sendBulkSms(smsRecipients, message, s.emailFromName);
        smsSent += result.smsSent;
        allRecipientNames.push(...result.recipients);
      }

      if (allRecipientNames.length > 0) {
        await database.insert(emailLog).values({
          subject: subjectLine,
          body: message,
          recipientGroup: "REMINDER",
          recipientCount: allRecipientNames.length,
          recipientList: allRecipientNames.join(", "),
          fromName: s.emailFromName,
          replyTo: s.emailReplyTo,
        });
      }
    }
  }

  return { remindersSent, emailsSent, smsSent };
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

  if (validateEmailConfig()) {
    // Resend not configured — skip silently
    return { urgentNoticesSent: 0 };
  }

  const tomorrowSlots = await database
    .select()
    .from(gameSlots)
    .where(eq(gameSlots.date, tomorrowStr));

  let urgentNoticesSent = 0;
  let smsSent = 0;

  for (const slot of tomorrowSlots) {
    const slotSignups = await database
      .select({
        playerId: signups.playerId,
        playerName: players.name,
        playerEmail: players.email,
        playerPhone: players.phone,
        playerCarrier: players.carrier,
      })
      .from(signups)
      .innerJoin(players, eq(signups.playerId, players.id))
      .where(eq(signups.gameSlotId, slot.id));

    // Only send for incomplete games that have at least 1 player
    if (slotSignups.length === 0 || slotSignups.length >= slot.maxPlayers) continue;

    const playerNames = slotSignups.map((s) => s.playerName).join(", ");
    const message = `URGENT: Tomorrow's game (${tomorrowStr}) on Court ${slot.courtNumber} at ${slot.timeSlot} needs more players!\n\nCurrently signed up (${slotSignups.length}/${slot.maxPlayers}): ${playerNames}\n\nPlease help find additional players.`;
    const subjectLine = `URGENT: Tomorrow's game needs players - Court ${slot.courtNumber}`;

    // Create in-app notifications
    for (const signup of slotSignups) {
      await database.insert(notifications).values({
        playerId: signup.playerId,
        type: "REMINDER",
        message: `URGENT: Tomorrow's game on Court ${slot.courtNumber} needs more players! (${slotSignups.length}/${slot.maxPlayers})`,
      });
    }

    const emailRecipients: Recipient[] = slotSignups
      .filter((s) => s.playerEmail)
      .map((s) => ({ name: s.playerName, email: s.playerEmail! }));

    const smsRecipients: SmsRecipient[] = slotSignups
      .filter((s) => s.playerPhone && s.playerCarrier)
      .map((s) => ({ name: s.playerName, phone: s.playerPhone!, carrier: s.playerCarrier! }));

    const allRecipientNames: string[] = [];

    if (emailRecipients.length > 0) {
      const result = await sendBulkEmails(emailRecipients, subjectLine, message, s.emailFromName, s.emailReplyTo || undefined);
      urgentNoticesSent += result.sent;
      allRecipientNames.push(...result.recipients);
    }

    if (smsRecipients.length > 0) {
      const result = await sendBulkSms(smsRecipients, message, s.emailFromName);
      smsSent += result.smsSent;
      allRecipientNames.push(...result.recipients);
    }

    if (allRecipientNames.length > 0) {
      await database.insert(emailLog).values({
        subject: subjectLine,
        body: message,
        recipientGroup: "URGENT",
        recipientCount: allRecipientNames.length,
        recipientList: allRecipientNames.join(", "),
        fromName: s.emailFromName,
        replyTo: s.emailReplyTo,
      });
    }
  }

  return { urgentNoticesSent, smsSent };
}
