import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull().default(""),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
