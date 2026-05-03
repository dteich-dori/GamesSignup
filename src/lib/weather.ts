/**
 * Weather utilities for the home-page rain forecast.
 *
 * The Scheduler shows games as a date (YYYY-MM-DD) plus a free-form `timeSlot`
 * string typed by the admin (e.g. "08:15-09:45" or "8:00 AM - 10:00 AM").
 * To compute the rain
 * window we need to parse that into start/end hour-minute pairs.
 *
 * The "wet courts" window is [game_start - HOURS_BEFORE_GAME, game_end].
 * Rain in the hours leading up to a game wets the courts and they take time
 * to dry; rain during the game obviously also matters.
 */

export const HOURS_BEFORE_GAME = 6;

export interface HourlyPoint {
  time: string; // "2026-05-03T08:00" — local time at the configured timezone
  precipProb: number; // 0-100
  precip: number; // mm
}

export interface WeatherFeed {
  enabled: boolean;
  timezone?: string;
  hourly: HourlyPoint[];
  error?: string;
}

/**
 * Parse a timeSlot like "08:15-09:45" or "8:00 AM - 10:00 AM" into [startHour, startMin, endHour, endMin]
 * Returns null if parsing fails. Tolerant of variations: "8 AM-10 AM", "08:00-10:00", etc.
 */
export function parseTimeSlot(timeSlot: string): {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
} | null {
  if (!timeSlot) return null;
  const parts = timeSlot.split(/\s*[-–—]\s*/); // split on -, en-dash, em-dash
  if (parts.length !== 2) return null;
  const start = parseClockTime(parts[0]);
  const end = parseClockTime(parts[1]);
  if (!start || !end) return null;
  return { startHour: start.h, startMin: start.m, endHour: end.h, endMin: end.m };
}

function parseClockTime(s: string): { h: number; m: number } | null {
  const trimmed = s.trim().toUpperCase();
  // Match patterns like "8:00 AM", "8 AM", "08:00", "10:30 PM", "20:00"
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const ampm = ampmMatch[3];
    if (h === 12) h = ampm === "AM" ? 0 : 12;
    else if (ampm === "PM") h += 12;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { h, m };
  }
  const military = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (military) {
    const h = parseInt(military[1], 10);
    const m = military[2] ? parseInt(military[2], 10) : 0;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { h, m };
  }
  return null;
}

/**
 * Compute the local-time window the courts are at risk of being wet for a
 * given game. Returns Date objects in the local timezone of the weather feed.
 *
 * The window starts HOURS_BEFORE_GAME hours before the game's start time and
 * ends at the game's end time.
 */
export function getRainWindow(
  date: string, // YYYY-MM-DD
  timeSlot: string
): { start: Date; end: Date } | null {
  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) return null;
  const [y, mo, d] = date.split("-").map((s) => parseInt(s, 10));
  if (!y || !mo || !d) return null;

  // Build "wall clock" Date objects (interpreted in the local zone of whoever
  // calls toString later — but since we only use them for hour comparisons
  // against the hourly[] feed which is also in the configured local zone,
  // they're consistent).
  const start = new Date(y, mo - 1, d, parsed.startHour, parsed.startMin);
  const end = new Date(y, mo - 1, d, parsed.endHour, parsed.endMin);
  // Window starts HOURS_BEFORE_GAME hours before the game start
  const windowStart = new Date(start.getTime() - HOURS_BEFORE_GAME * 60 * 60 * 1000);
  return { start: windowStart, end };
}

/**
 * Find the maximum precipitation probability across the rain window for one
 * game. Returns null if the date+time can't be parsed or no hourly data
 * covers the window.
 */
export function getRainProbabilityForGame(
  hourly: HourlyPoint[],
  date: string,
  timeSlot: string
): number | null {
  const window = getRainWindow(date, timeSlot);
  if (!window) return null;
  if (hourly.length === 0) return null;

  let max = -1;
  for (const point of hourly) {
    // point.time is local-zone wall clock string like "2026-05-03T08:00"
    // Parse with same wall-clock semantics as getRainWindow built
    const m = point.time.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) continue;
    const py = parseInt(m[1], 10);
    const pmo = parseInt(m[2], 10);
    const pd = parseInt(m[3], 10);
    const ph = parseInt(m[4], 10);
    const pm = parseInt(m[5], 10);
    const pointDate = new Date(py, pmo - 1, pd, ph, pm);
    if (pointDate >= window.start && pointDate <= window.end) {
      if (point.precipProb > max) max = point.precipProb;
    }
  }
  return max < 0 ? null : max;
}

/**
 * Color/severity bucket for a given probability. Used by the UI.
 */
export function rainSeverity(prob: number): "low" | "medium" | "high" {
  if (prob >= 60) return "high";
  if (prob >= 30) return "medium";
  return "low";
}
