import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const database = await db();
  const allPlayers = await database.select().from(players).orderBy(players.name);
  return NextResponse.json(allPlayers);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const database = await db();

  // Check for duplicate name
  const existing = await database.select().from(players).where(eq(players.name, name.trim()));
  if (existing.length > 0) {
    return NextResponse.json({ error: "A player with this name already exists" }, { status: 409 });
  }

  const [created] = await database.insert(players).values({
    name: name.trim(),
    email: email?.trim() || null,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, email, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: "Player ID is required" }, { status: 400 });
  }

  const database = await db();
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) updateData.name = name.trim();
  if (email !== undefined) updateData.email = email?.trim() || null;
  if (isActive !== undefined) updateData.isActive = isActive;

  const [updated] = await database
    .update(players)
    .set(updateData)
    .where(eq(players.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Player ID is required" }, { status: 400 });
  }

  const database = await db();
  await database.delete(players).where(eq(players.id, id));

  return NextResponse.json({ success: true });
}
