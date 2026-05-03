import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Geocode a US ZIP code to {lat, lon} using Open-Meteo's free geocoding API.
 * Returns null if the lookup fails — caller should fall back to existing
 * coordinates so the rain forecast doesn't break.
 */
async function geocodeZip(zip: string): Promise<{ lat: string; lon: string } | null> {
  if (!zip || !/^\d{5}/.test(zip.trim())) return null;
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", zip.trim());
    url.searchParams.set("count", "1");
    url.searchParams.set("country", "US");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ latitude: number; longitude: number }> };
    if (!data.results || data.results.length === 0) return null;
    const { latitude, longitude } = data.results[0];
    return { lat: String(latitude), lon: String(longitude) };
  } catch {
    return null;
  }
}

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
  const current = (await database.select().from(settings))[0];

  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    "clubName", "courtsAvailable", "defaultTimeSlot", "playersPerGame",
    "daysAhead", "reservationCutoffHours", "reminderTime",
    "creatorPlayerId", "creatorPin", "maintainerPlayerId", "maintainerPin",
    "errorReportEmail", "startDate",
    "emailFromName", "emailReplyTo", "emailTestAddress",
    "emailTestPhone", "emailTestCarrier",
    "reminderTemplate", "urgentTemplate", "courtReservationTemplate",
    "dropdownResetSeconds",
    "weatherZip", "weatherLat", "weatherLon", "weatherEnabled",
  ];

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  // If the ZIP changed, transparently re-geocode so lat/lon stay in sync.
  if ("weatherZip" in updateData && updateData.weatherZip !== current?.weatherZip) {
    const geo = await geocodeZip(String(updateData.weatherZip));
    if (geo) {
      updateData.weatherLat = geo.lat;
      updateData.weatherLon = geo.lon;
    }
  }

  const [updated] = await database
    .update(settings)
    .set(updateData)
    .where(eq(settings.id, 1))
    .returning();

  return NextResponse.json(updated);
}
