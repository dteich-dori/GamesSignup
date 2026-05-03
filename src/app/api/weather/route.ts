import { NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { settings } from "@/db/schema";

/**
 * GET /api/weather
 *
 * Returns hourly precipitation probability for the next ~16 days at the
 * configured weather location. The home page calls this once on load and
 * computes per-game rain windows client-side.
 *
 * Response shape:
 * {
 *   enabled: boolean,
 *   timezone: string,
 *   hourly: Array<{ time: string; precipProb: number }>
 * }
 *
 * Cached for 30 minutes via Cache-Control to limit Open-Meteo calls.
 */
export async function GET() {
  const database = await db();
  const rows = await database.select().from(settings);
  const s = rows[0];

  if (!s || !s.weatherEnabled) {
    return NextResponse.json({ enabled: false, hourly: [] });
  }

  const lat = parseFloat(s.weatherLat || "40.7989");
  const lon = parseFloat(s.weatherLon || "-74.2390");
  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ enabled: false, error: "Invalid coordinates", hourly: [] });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("hourly", "precipitation_probability,precipitation");
  url.searchParams.set("timezone", "America/New_York");
  url.searchParams.set("forecast_days", "16");

  try {
    const res = await fetch(url.toString(), {
      // Vercel/Next caches the upstream response for 30 minutes
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { enabled: true, error: `Open-Meteo returned ${res.status}`, hourly: [] },
        { status: 502 }
      );
    }
    const data = await res.json() as {
      timezone: string;
      hourly: {
        time: string[];
        precipitation_probability: (number | null)[];
        precipitation: (number | null)[];
      };
    };

    // Pair time and precip into a flat array for easy client lookup
    const hourly = data.hourly.time.map((t, i) => ({
      time: t, // local time, e.g. "2026-05-03T08:00"
      precipProb: data.hourly.precipitation_probability[i] ?? 0,
      precip: data.hourly.precipitation[i] ?? 0,
    }));

    return NextResponse.json(
      {
        enabled: true,
        timezone: data.timezone,
        hourly,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=1800, s-maxage=1800",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { enabled: true, error: String(err), hourly: [] },
      { status: 502 }
    );
  }
}
