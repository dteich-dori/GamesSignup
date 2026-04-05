import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { players, settings, emailLog, activityLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendBulkEmails, sendBulkSms, validateResendKey, type Recipient, type SmsRecipient } from "@/lib/email";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { recipientGroup, subject, body: emailBody, channel } = body;
  // channel: "email" | "sms" | "both" (default "both")

  if (!recipientGroup || !subject || !emailBody) {
    return NextResponse.json(
      { error: "recipientGroup, subject, and body are required" },
      { status: 400 }
    );
  }

  const keyError = validateResendKey();
  if (keyError) {
    return NextResponse.json({ error: keyError }, { status: 500 });
  }

  const database = await db();
  const settingsRows = await database.select().from(settings);
  const s = settingsRows[0];
  if (!s) {
    return NextResponse.json({ error: "Settings not initialized" }, { status: 500 });
  }

  const fromName = s.emailFromName;
  const replyTo = s.emailReplyTo || undefined;
  const selectedChannel = channel || "both";

  // Build recipient lists with smart routing (no duplicates)
  let emailRecipients: Recipient[] = [];
  let smsRecipients: SmsRecipient[] = [];

  if (recipientGroup === "Test") {
    const hasTestEmail = !!(s.emailTestAddress);
    const hasTestSms = !!(s.emailTestPhone && s.emailTestCarrier);

    if (!hasTestEmail && !hasTestSms) {
      return NextResponse.json({ error: "No test email or phone configured in settings" }, { status: 400 });
    }

    if (selectedChannel === "email") {
      if (hasTestEmail) emailRecipients = [{ name: "Test", email: s.emailTestAddress }];
    } else if (selectedChannel === "sms") {
      if (hasTestSms) {
        smsRecipients = [{ name: "Test", phone: s.emailTestPhone, carrier: s.emailTestCarrier }];
      } else if (hasTestEmail) {
        emailRecipients = [{ name: "Test (SMS fallback)", email: s.emailTestAddress }];
      }
    } else {
      // "both": prefer SMS, fall back to email
      if (hasTestSms) {
        smsRecipients = [{ name: "Test", phone: s.emailTestPhone, carrier: s.emailTestCarrier }];
      } else if (hasTestEmail) {
        emailRecipients = [{ name: "Test", email: s.emailTestAddress }];
      }
    }
  } else {
    const playerRows = await database
      .select({
        name: players.name,
        email: players.email,
        phone: players.phone,
        carrier: players.carrier,
      })
      .from(players)
      .where(eq(players.isActive, true));

    for (const p of playerRows) {
      const hasSms = !!(p.phone && p.carrier);
      const hasEmail = !!(p.email && p.email.trim());

      if (selectedChannel === "email") {
        // Email only
        if (hasEmail) {
          emailRecipients.push({ name: p.name, email: p.email! });
        }
      } else if (selectedChannel === "sms") {
        // Prefer SMS; fall back to email for players without SMS
        if (hasSms) {
          smsRecipients.push({ name: p.name, phone: p.phone!, carrier: p.carrier! });
        } else if (hasEmail) {
          emailRecipients.push({ name: p.name, email: p.email! });
        }
      } else {
        // "both": SMS for players with phone+carrier, email for the rest (no duplicates)
        if (hasSms) {
          smsRecipients.push({ name: p.name, phone: p.phone!, carrier: p.carrier! });
        } else if (hasEmail) {
          emailRecipients.push({ name: p.name, email: p.email! });
        }
      }
    }
  }

  if (emailRecipients.length === 0 && smsRecipients.length === 0) {
    return NextResponse.json({ error: "No recipients found" }, { status: 400 });
  }

  // Send emails
  const emailResult = await sendBulkEmails(emailRecipients, subject, emailBody, fromName, replyTo);

  // Send SMS
  let smsResult = { sent: 0, smsSent: 0, errors: [] as string[], skipped: [] as string[], recipients: [] as string[] };
  if (smsRecipients.length > 0) {
    smsResult = await sendBulkSms(smsRecipients, emailBody, fromName);
  }

  const totalSent = emailResult.sent + smsResult.smsSent;
  const allRecipients = [...emailResult.recipients, ...smsResult.recipients];

  // Log to email log
  const channelLabel = selectedChannel === "email" ? "Email" :
    selectedChannel === "sms" ? "Text" : "Email+Text";

  if (totalSent > 0) {
    await database.insert(emailLog).values({
      subject,
      body: emailBody,
      recipientGroup: `${recipientGroup} (${channelLabel})`,
      recipientCount: totalSent,
      recipientList: allRecipients.join(", "),
      fromName,
      replyTo: s.emailReplyTo,
    });
  }

  // Log to activity log
  await database.insert(activityLog).values({
    action: "SEND_EMAIL",
    details: JSON.stringify({
      recipientGroup,
      channel: selectedChannel,
      emailsSent: emailResult.sent,
      smsSent: smsResult.smsSent,
      subject,
    }),
  });

  const warnings = [
    ...emailResult.skipped, ...emailResult.errors,
    ...smsResult.skipped, ...smsResult.errors,
  ];

  return NextResponse.json({
    success: true,
    emailsSent: emailResult.sent,
    smsSent: smsResult.smsSent,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}
