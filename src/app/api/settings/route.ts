import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const database = await db();
  const rows = await database.select().from(settings);

  if (rows.length === 0) {
    // Initialize default settings
    const [created] = await database.insert(settings).values({}).returning();
    return NextResponse.json(created);
  }

  return NextResponse.json(rows[0]);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const database = await db();

  // Ensure settings row exists
  const rows = await database.select().from(settings);
  if (rows.length === 0) {
    await database.insert(settings).values({});
  }

  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    "clubName", "courtsAvailable", "defaultTimeSlot", "playersPerGame",
    "daysAhead", "reservationCutoffHours", "reminderTime",
    "creatorPlayerId", "creatorPin", "maintainerPlayerId", "maintainerPin",
    "errorReportEmail", "startDate",
    "emailFromName", "emailReplyTo", "emailTestAddress",
    "emailTestPhone", "emailTestCarrier",
    "reminderTemplate", "urgentTemplate",
    "dropdownResetSeconds",
  ];

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  const [updated] = await database
    .update(settings)
    .set(updateData)
    .where(eq(settings.id, 1))
    .returning();

  return NextResponse.json(updated);
}
