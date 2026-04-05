import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const emailLog = sqliteTable("email_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipientGroup: text("recipient_group").notNull(), // ALL, Test, REMINDER, URGENT
  recipientCount: integer("recipient_count").notNull(),
  recipientList: text("recipient_list").notNull(), // comma-separated names
  fromName: text("from_name").notNull(),
  replyTo: text("reply_to").notNull().default(""),
  sentAt: text("sent_at").notNull().$defaultFn(() => new Date().toISOString()),
});
