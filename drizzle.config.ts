import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle/migrations",
  dialect: authToken ? "turso" : "sqlite",
  ...(authToken
    ? { dbCredentials: { url, authToken } }
    : { dbCredentials: { url } }),
});
