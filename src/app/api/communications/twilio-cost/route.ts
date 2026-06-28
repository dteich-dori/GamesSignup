import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { emailLog } from "@/db/schema";
import { gte } from "drizzle-orm";

/**
 * GET /api/communications/twilio-cost?startDate=YYYY-MM-DD
 *
 * Returns SMS-channel send statistics from email_log on or after the
 * given startDate, used by the Twilio Cost Estimate page.
 *
 * The log records each send BATCH (not each message), with the channel
 * encoded in the recipientGroup label as "(Email)", "(Text)", or
 * "(Email+Text)" — we parse that to attribute SMS counts.
 *
 * NOTE: We CANNOT tell from the log alone whether a given SMS batch went
 * out via Twilio or via the free carrier-email gateway, because the
 * transport choice happens at send time and isn't persisted. So the
 * caller passes the date Twilio was enabled, and we only count sends on
 * or after that date.
 */
export async function GET(request: NextRequest) {
  try {
    const startDate = request.nextUrl.searchParams.get("startDate");
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return NextResponse.json(
        { error: "startDate (YYYY-MM-DD) required" },
        { status: 400 }
      );
    }
    const database = await db();

    // sentAt is stored as ISO timestamp; filter from start of that date.
    const startIso = startDate + "T00:00:00.000Z";
    const logs = await database
      .select()
      .from(emailLog)
      .where(gte(emailLog.sentAt, startIso));

    let smsOnlyCount = 0;
    let dualSendCount = 0;
    const batches: {
      id: number;
      sentAt: string;
      recipientGroup: string;
      recipientCount: number;
      channel: "text" | "text+email" | "email" | "other";
      estimatedSmsCount: number;
    }[] = [];

    for (const row of logs) {
      const label = row.recipientGroup;
      let channel: "text" | "text+email" | "email" | "other";
      let estimatedSmsCount = 0;
      if (label.includes("(Email+Text")) {
        channel = "text+email";
        estimatedSmsCount = row.recipientCount;
        dualSendCount += row.recipientCount;
      } else if (label.includes("(Text)")) {
        channel = "text";
        estimatedSmsCount = row.recipientCount;
        smsOnlyCount += row.recipientCount;
      } else if (label.includes("(Email)")) {
        channel = "email";
      } else {
        channel = "other";
      }
      batches.push({
        id: row.id,
        sentAt: row.sentAt,
        recipientGroup: row.recipientGroup,
        recipientCount: row.recipientCount,
        channel,
        estimatedSmsCount,
      });
    }
    batches.sort((a, b) => a.sentAt.localeCompare(b.sentAt));

    const estimatedSmsSegments = smsOnlyCount + dualSendCount;

    const start = new Date(startDate + "T00:00:00");
    const today = new Date();
    const monthsElapsed = Math.max(
      0,
      (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
    );

    return NextResponse.json({
      startDate,
      monthsElapsed: Math.round(monthsElapsed * 10) / 10,
      smsOnlyCount,
      dualSendCount,
      estimatedSmsSegments,
      batches,
    });
  } catch (err) {
    console.error("[twilio-cost GET] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
