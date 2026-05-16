import { eq, asc } from "drizzle-orm";
import { gameSlots, signups, players, notifications, settings, emailLog } from "@/db/schema";
import { sendBulkEmails, sendBulkSms, validateEmailConfig, type Recipient, type SmsRecipient } from "./email";
import type { Database } from "@/db/index";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
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
      })
      .from(signups)
      .innerJoin(players, eq(signups.playerId, players.id))
      .where(eq(signups.gameSlotId, slot.id));

    // Only send reminders for complete games
    if (slotSignups.length < slot.maxPlayers) continue;

    const playerNames = slotSignups.map((s) => s.playerName).join(", ");
    const templateVars = {
      date: tomorrowStr,
      court: String(slot.courtNumber),
      time: slot.timeSlot,
      players: playerNames,
      count: String(slotSignups.length),
      max: String(slot.maxPlayers),
    };
    const message = applyTemplate(s.reminderTemplate, templateVars);
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
        .filter((s) => s.playerPhone)
        .map((s) => ({ name: s.playerName, phone: s.playerPhone! }));

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
      })
      .from(signups)
      .innerJoin(players, eq(signups.playerId, players.id))
      .where(eq(signups.gameSlotId, slot.id));

    // Only send for incomplete games that have at least 1 player
    if (slotSignups.length === 0 || slotSignups.length >= slot.maxPlayers) continue;

    const playerNames = slotSignups.map((s) => s.playerName).join(", ");
    const templateVars = {
      date: tomorrowStr,
      court: String(slot.courtNumber),
      time: slot.timeSlot,
      players: playerNames,
      count: String(slotSignups.length),
      max: String(slot.maxPlayers),
    };
    const message = applyTemplate(s.urgentTemplate, templateVars);
    const subjectLine = `URGENT: Tomorrow's game needs players - Court ${slot.courtNumber}`;

    // Create in-app notifications
    for (const signup of slotSignups) {
      await database.insert(notifications).values({
        playerId: signup.playerId,
        type: "REMINDER",
        message: applyTemplate(s.urgentTemplate, templateVars),
      });
    }

    const emailRecipients: Recipient[] = slotSignups
      .filter((s) => s.playerEmail)
      .map((s) => ({ name: s.playerName, email: s.playerEmail! }));

    const smsRecipients: SmsRecipient[] = slotSignups
      .filter((s) => s.playerPhone)
      .map((s) => ({ name: s.playerName, phone: s.playerPhone! }));

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

/**
 * Send a reminder to players in tomorrow's *complete* games when no physical
 * court has been reserved yet (the Court # checkbox is unchecked / reservedCourt
 * is null). Reaches each player by their preferred channel — SMS if phone +
 * phone is configured, otherwise email.
 */
export async function sendCourtReservationReminders(database: Database) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const settingsRows = await database.select().from(settings);
  const s = settingsRows[0];
  if (!s) return { courtReminderRemindersSent: 0, emailsSent: 0, smsSent: 0 };

  if (validateEmailConfig()) {
    return { courtReminderRemindersSent: 0, emailsSent: 0, smsSent: 0 };
  }

  const tomorrowSlots = await database
    .select()
    .from(gameSlots)
    .where(eq(gameSlots.date, tomorrowStr));

  let courtReminderRemindersSent = 0;
  let emailsSent = 0;
  let smsSent = 0;

  for (const slot of tomorrowSlots) {
    // Only complete games where the court hasn't been reserved yet
    const reservation = (slot.reservedCourt || "").trim();
    if (reservation) continue; // already reserved — skip

    // Order signups so the FIRST player to sign up is the one we notify.
    // Only one person needs to physically reserve the court.
    const slotSignups = await database
      .select({
        playerId: signups.playerId,
        playerName: players.name,
        playerEmail: players.email,
        playerPhone: players.phone,
        signedUpAt: signups.signedUpAt,
      })
      .from(signups)
      .innerJoin(players, eq(signups.playerId, players.id))
      .where(eq(signups.gameSlotId, slot.id))
      .orderBy(asc(signups.signedUpAt), asc(signups.id));

    if (slotSignups.length < slot.maxPlayers) continue; // game not full — skip

    const allPlayerNames = slotSignups.map((p) => p.playerName).join(", ");
    const firstPlayer = slotSignups[0];

    const templateVars = {
      date: tomorrowStr,
      court: String(slot.courtNumber),
      time: slot.timeSlot,
      players: allPlayerNames,
      count: String(slotSignups.length),
      max: String(slot.maxPlayers),
    };
    const message = applyTemplate(s.courtReservationTemplate, templateVars);
    const subjectLine = `Reserve a court — Tomorrow ${tomorrowStr}, Court ${slot.courtNumber}`;

    // In-app notification ONLY for the first player (the one being asked to reserve)
    await database.insert(notifications).values({
      playerId: firstPlayer.playerId,
      type: "REMINDER",
      message,
    });
    courtReminderRemindersSent++;

    const emailRecipients: Recipient[] = firstPlayer.playerEmail
      ? [{ name: firstPlayer.playerName, email: firstPlayer.playerEmail }]
      : [];

    const smsRecipients: SmsRecipient[] = firstPlayer.playerPhone
      ? [{ name: firstPlayer.playerName, phone: firstPlayer.playerPhone }]
      : [];

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
        recipientGroup: "COURT_RESERVATION",
        recipientCount: allRecipientNames.length,
        recipientList: allRecipientNames.join(", "),
        fromName: s.emailFromName,
        replyTo: s.emailReplyTo,
      });
    }
  }

  return { courtReminderRemindersSent, emailsSent, smsSent };
}
