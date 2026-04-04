import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { settings } from "@/db/schema";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  if (!pin) {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }

  const database = await db();
  const rows = await database.select().from(settings);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Settings not initialized" }, { status: 500 });
  }

  const s = rows[0];

  if (pin === s.creatorPin) {
    return NextResponse.json({ role: "creator" });
  }

  if (pin === s.maintainerPin) {
    return NextResponse.json({ role: "maintainer" });
  }

  return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
}
