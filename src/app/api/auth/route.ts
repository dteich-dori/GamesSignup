import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { settings } from "@/db/schema";

export async function POST(request: NextRequest) {
  const { pin, playerId } = await request.json();

  const database = await db();
  const rows = await database.select().from(settings);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Settings not initialized" }, { status: 500 });
  }

  const s = rows[0];

  // Allow creator access when no PINs are configured (first-time setup)
  if (!s.creatorPin && !s.maintainerPin) {
    return NextResponse.json({ role: "creator", firstTime: true });
  }

  // Check if this player is an admin
  if (playerId && !pin) {
    // Just checking if player is admin (no PIN yet)
    if (playerId === s.creatorPlayerId || playerId === s.maintainerPlayerId) {
      return NextResponse.json({ isAdmin: true });
    }
    return NextResponse.json({ isAdmin: false });
  }

  // Validate PIN for a specific player
  if (playerId && pin) {
    if (playerId === s.creatorPlayerId && pin === s.creatorPin) {
      return NextResponse.json({ role: "creator" });
    }
    if (playerId === s.maintainerPlayerId && pin === s.maintainerPin) {
      return NextResponse.json({ role: "maintainer" });
    }
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  // Legacy: PIN-only auth (for setup page direct access)
  if (pin === s.creatorPin && s.creatorPin) {
    return NextResponse.json({ role: "creator" });
  }
  if (pin === s.maintainerPin && s.maintainerPin) {
    return NextResponse.json({ role: "maintainer" });
  }

  return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
}
