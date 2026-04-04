import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    hasUrl: !!process.env.TURSO_DATABASE_URL,
    urlPrefix: process.env.TURSO_DATABASE_URL?.substring(0, 20),
    hasToken: !!process.env.TURSO_AUTH_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  });
}
