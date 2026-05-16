import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { players, settings } from "@/db/schema";
import { eq, and, gt, isNotNull, ne, asc, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group") || "ALL";
  const since = searchParams.get("since"); // YYYY-MM-DD for New Players
  const ids = searchParams.get("ids"); // comma-separated player IDs for Selected

  const database = await db();

  if (group === "Test") {
    const settingsRows = await database.select().from(settings);
    const testEmail = settingsRows[0]?.emailTestAddress;
    if (!testEmail) {
      return NextResponse.json([]);
    }
    return NextResponse.json([{ name: "Test", email: testEmail }]);
  }

  // "List": full active player list (used for the multi-select picker, no email filter)
  if (group === "List") {
    const result = await database
      .select({ id: players.id, name: players.name, email: players.email, phone: players.phone })
      .from(players)
      .where(eq(players.isActive, true))
      .orderBy(asc(players.name));
    return NextResponse.json(result);
  }

  // Base conditions: active players with email
  const conditions = [
    eq(players.isActive, true),
    isNotNull(players.email),
    ne(players.email, ""),
  ];

  // New Players: filter by createdAt > since date
  if (group === "New" && since) {
    conditions.push(gt(players.createdAt, since));
  }

  // Selected: filter by specific player IDs (no email requirement so SMS-only players come through)
  if (group === "Selected" && ids) {
    const idArray = ids.split(",").map((s) => Number(s)).filter((n) => !isNaN(n));
    if (idArray.length === 0) {
      return NextResponse.json([]);
    }
    const result = await database
      .select({ name: players.name, email: players.email })
      .from(players)
      .where(and(eq(players.isActive, true), inArray(players.id, idArray)))
      .orderBy(asc(players.name));
    return NextResponse.json(result);
  }

  const result = await database
    .select({ name: players.name, email: players.email, createdAt: players.createdAt })
    .from(players)
    .where(and(...conditions))
    .orderBy(asc(players.name));

  return NextResponse.json(result);
}
