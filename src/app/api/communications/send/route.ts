import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { players, settings, emailLog, activityLog } from "@/db/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { sendBulkEmails, validateResendKey, type Recipient } from "@/lib/email";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { recipientGroup, subject, body: emailBody } = body;

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

  // Build recipient list
  let recipients: Recipient[] = [];

  if (recipientGroup === "Test") {
    if (!s.emailTestAddress) {
      return NextResponse.json({ error: "No test email configured in settings" }, { status: 400 });
    }
    recipients = [{ name: "Test", email: s.emailTestAddress }];
  } else {
    // ALL active players with email
    const playerRows = await database
      .select({ name: players.name, email: players.email })
      .from(players)
      .where(
        and(
          eq(players.isActive, true),
          isNotNull(players.email),
          ne(players.email, "")
        )
      );
    recipients = playerRows.map((p) => ({ name: p.name, email: p.email! }));
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients with valid emails" }, { status: 400 });
  }

  // Send emails
  const result = await sendBulkEmails(recipients, subject, emailBody, fromName, replyTo);

  // Log to email log
  if (result.sent > 0) {
    await database.insert(emailLog).values({
      subject,
      body: emailBody,
      recipientGroup,
      recipientCount: result.sent,
      recipientList: result.recipients.join(", "),
      fromName,
      replyTo: s.emailReplyTo,
    });
  }

  // Log to activity log
  await database.insert(activityLog).values({
    action: "SEND_EMAIL",
    details: JSON.stringify({
      recipientGroup,
      recipientCount: result.sent,
      subject,
    }),
  });

  const warnings = [...result.skipped, ...result.errors];

  return NextResponse.json({
    success: true,
    recipientCount: result.sent,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}
