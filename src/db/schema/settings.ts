import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clubName: text("club_name").notNull().default("West Orange Tennis Club"),
  courtsAvailable: integer("courts_available").notNull().default(3),
  defaultTimeSlot: text("default_time_slot").notNull().default("8:00 AM - 10:00 AM"),
  playersPerGame: integer("players_per_game").notNull().default(4),
  daysAhead: integer("days_ahead").notNull().default(10),
  reservationCutoffHours: integer("reservation_cutoff_hours").notNull().default(24),
  reminderTime: text("reminder_time").notNull().default("18:00"),
  creatorPlayerId: integer("creator_player_id"),
  creatorPin: text("creator_pin").notNull().default(""),
  maintainerPlayerId: integer("maintainer_player_id"),
  maintainerPin: text("maintainer_pin").notNull().default(""),
  errorReportEmail: text("error_report_email"),
  startDate: text("start_date"),
  emailFromName: text("email_from_name").notNull().default("Games Signup"),
  emailReplyTo: text("email_reply_to").notNull().default(""),
  emailTestAddress: text("email_test_address").notNull().default(""),
});
