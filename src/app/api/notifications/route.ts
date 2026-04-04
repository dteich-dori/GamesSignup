import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { notifications } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = Number(searchParams.get("playerId"));

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const database = await db();
  const notifs = await database
    .select()
    .from(notifications)
    .where(eq(notifications.playerId, playerId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return NextResponse.json(notifs);
}

export async function PUT(request: NextRequest) {
  const { id, read } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
  }

  const database = await db();
  const [updated] = await database
    .update(notifications)
    .set({ read: read ?? true })
    .where(eq(notifications.id, id))
    .returning();

  return NextResponse.json(updated);
}
