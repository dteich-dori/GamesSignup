import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { players, settings } from "@/db/schema";
import { eq, and, isNotNull, ne, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group") || "ALL";

  const database = await db();

  if (group === "Test") {
    const settingsRows = await database.select().from(settings);
    const testEmail = settingsRows[0]?.emailTestAddress;
    if (!testEmail) {
      return NextResponse.json([]);
    }
    return NextResponse.json([{ name: "Test", email: testEmail }]);
  }

  // ALL: active players with non-empty email
  const result = await database
    .select({ name: players.name, email: players.email })
    .from(players)
    .where(
      and(
        eq(players.isActive, true),
        isNotNull(players.email),
        ne(players.email, "")
      )
    )
    .orderBy(asc(players.name));

  return NextResponse.json(result);
}
