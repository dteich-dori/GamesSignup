import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { emailTemplates } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const database = await db();
  const templates = await database
    .select()
    .from(emailTemplates)
    .orderBy(asc(emailTemplates.name));
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, subject, body: templateBody } = body;

  if (!name?.trim() || !subject?.trim()) {
    return NextResponse.json({ error: "Name and subject are required" }, { status: 400 });
  }

  const database = await db();
  const [created] = await database.insert(emailTemplates).values({
    name: name.trim(),
    subject: subject.trim(),
    body: templateBody || "",
  }).returning();

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
  }

  const database = await db();
  await database.delete(emailTemplates).where(eq(emailTemplates.id, id));
  return NextResponse.json({ success: true });
}
