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

  // Pull every row from every table. The dataset is small enough (a few
  // hundred rows max) that a single pass is fine.
  const [
    settingsRows,
    playersRows,
    gameSlotsRows,
    signupsRows,
    activityLogRows,
    notificationsRows,
    emailLogRows,
    emailTemplatesRows,
    gameStatsRows,
  ] = await Promise.all([
    database.select().from(settings),
    database.select().from(players),
    database.select().from(gameSlots),
    database.select().from(signups),
    database.select().from(activityLog),
    database.select().from(notifications),
    database.select().from(emailLog),
    database.select().from(emailTemplates),
    database.select().from(gameStats),
  ]);

  const generatedAt = new Date().toISOString();
  const totalRows =
    settingsRows.length +
    playersRows.length +
    gameSlotsRows.length +
    signupsRows.length +
    activityLogRows.length +
    notificationsRows.length +
    emailLogRows.length +
    emailTemplatesRows.length +
    gameStatsRows.length;

  const dump = {
    app: "GamesSignup",
    version: APP_VERSION,
    generatedAt,
    totalRows,
    tables: {
      settings: settingsRows,
      players: playersRows,
      gameSlots: gameSlotsRows,
      signups: signupsRows,
      activityLog: activityLogRows,
      notifications: notificationsRows,
      emailLog: emailLogRows,
      emailTemplates: emailTemplatesRows,
      gameStats: gameStatsRows,
    },
  };

  // Build a sortable filename: gamessignup-backup-2026-05-04T15-30-22Z.json
  const stamp = generatedAt.replace(/:/g, "-").replace(/\..*$/, "Z");
  const filename = `gamessignup-backup-${stamp}.json`;

  return new NextResponse(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Backup-Filename": filename,
    },
  });
}
