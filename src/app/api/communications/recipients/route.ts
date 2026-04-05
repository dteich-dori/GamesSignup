import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { players, settings } from "@/db/schema";
import { eq, and, gt, isNotNull, ne, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group") || "ALL";
  const since = searchParams.get("since"); // YYYY-MM-DD for New Players

  const database = await db();

  if (group === "Test") {
    const settingsRows = await database.select().from(settings);
    const testEmail = settingsRows[0]?.emailTestAddress;
    if (!testEmail) {
      return NextResponse.json([]);
    }
    return NextResponse.json([{ name: "Test", email: testEmail }]);
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

  const result = await database
    .select({ name: players.name, email: players.email, createdAt: players.createdAt })
    .from(players)
    .where(and(...conditions))
    .orderBy(asc(players.name));

  return NextResponse.json(result);
}
