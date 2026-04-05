import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { players, settings, emailLog, activityLog } from "@/db/schema";
import { eq, and, isNotNull, ne, or } from "drizzle-orm";
import { sendBulkEmails, sendBulkSms, validateResendKey, type Recipient, type SmsRecipient } from "@/lib/email";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { recipientGroup, subject, body: emailBody, sendSms } = body;

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

  // Build recipient lists
  let emailRecipients: Recipient[] = [];
  let smsRecipients: SmsRecipient[] = [];

  if (recipientGroup === "Test") {
    if (!s.emailTestAddress) {
      return NextResponse.json({ error: "No test email configured in settings" }, { status: 400 });
    }
    emailRecipients = [{ name: "Test", email: s.emailTestAddress }];
  } else {
    // ALL active players
    const playerRows = await database
      .select({
        name: players.name,
        email: players.email,
        phone: players.phone,
        carrier: players.carrier,
      })
      .from(players)
      .where(eq(players.isActive, true));

    // Email recipients: players with email
    emailRecipients = playerRows
      .filter((p) => p.email && p.email.trim())
      .map((p) => ({ name: p.name, email: p.email! }));

    // SMS recipients: players with phone + carrier
    if (sendSms) {
      smsRecipients = playerRows
        .filter((p) => p.phone && p.carrier)
        .map((p) => ({ name: p.name, phone: p.phone!, carrier: p.carrier! }));
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
  if (totalSent > 0) {
    await database.insert(emailLog).values({
      subject,
      body: emailBody,
      recipientGroup: recipientGroup + (sendSms ? " +SMS" : ""),
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
