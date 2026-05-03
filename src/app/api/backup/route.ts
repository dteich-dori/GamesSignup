import { NextResponse } from "next/server";
import { db } from "@/db/getDb";
import {
  settings,
  players,
  gameSlots,
  signups,
  activityLog,
  notifications,
  emailLog,
  emailTemplates,
  gameStats,
} from "@/db/schema";
import { APP_VERSION } from "@/lib/version";

/**
 * Full JSON backup of every table in the GamesSignup database.
 * The file is streamed back as a download (Content-Disposition: attachment)
 * so the browser saves it to the user's Downloads folder.
 */
export async function GET() {
  const database = await db();

  // Each table is dumped independently with its own try/catch so a single
  // failure (e.g. a missing column or table) doesn't kill the whole backup.
  // Errors are reported alongside the data so the operator can see what was
  // skipped.
  const tables: Record<string, unknown[]> = {};
  const errors: Record<string, string> = {};

  async function dump<T>(name: string, runner: () => Promise<T[]>) {
    try {
      tables[name] = (await runner()) as unknown[];
    } catch (err) {
      tables[name] = [];
      errors[name] = err instanceof Error ? err.message : String(err);
    }
  }

  await Promise.all([
    dump("settings", () => database.select().from(settings)),
    dump("players", () => database.select().from(players)),
    dump("gameSlots", () => database.select().from(gameSlots)),
    dump("signups", () => database.select().from(signups)),
    dump("activityLog", () => database.select().from(activityLog)),
    dump("notifications", () => database.select().from(notifications)),
    dump("emailLog", () => database.select().from(emailLog)),
    dump("emailTemplates", () => database.select().from(emailTemplates)),
    dump("gameStats", () => database.select().from(gameStats)),
  ]);

  const generatedAt = new Date().toISOString();
  const totalRows = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);

  const dump_payload = {
    app: "GamesSignup",
    version: APP_VERSION,
    generatedAt,
    totalRows,
    tables,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };

  // Build a sortable filename: gamessignup-backup-2026-05-04T15-30-22Z.json
  const stamp = generatedAt.replace(/:/g, "-").replace(/\..*$/, "Z");
  const filename = `gamessignup-backup-${stamp}.json`;

  return new NextResponse(JSON.stringify(dump_payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Backup-Filename": filename,
    },
  });
}
