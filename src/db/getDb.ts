import { createDatabase, type Database } from "./index";

let cached: Database | null = null;

export async function db(): Promise<Database> {
  if (cached) return cached;

  const url = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  cached = createDatabase(url, authToken);
  return cached;
}
