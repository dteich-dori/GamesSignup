import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const database = await db();
    const rows = await database.select().from(settings);

    if (rows.length === 0) {
      // Initialize default settings
      const [created] = await database.insert(settings).values({}).returning();
      return NextResponse.json(created);
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      {
        error: String(error),
        message: (error as Error).message,
        envCheck: {
          hasUrl: !!process.env.TURSO_DATABASE_URL,
          urlPrefix: process.env.TURSO_DATABASE_URL?.substring(0, 15),
          hasToken: !!process.env.TURSO_AUTH_TOKEN,
        },
      },
      { status: 500 }
    );
  }
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
    "creatorPin", "maintainerPin", "errorReportEmail",
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
