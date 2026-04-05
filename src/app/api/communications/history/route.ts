import { NextResponse } from "next/server";
import { db } from "@/db/getDb";
import { emailLog } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const database = await db();

  const logs = await database
    .select()
    .from(emailLog)
    .orderBy(desc(emailLog.sentAt))
    .limit(100);

  return NextResponse.json(logs);
}
