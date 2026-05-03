import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clubName: text("club_name").notNull().default("West Orange Tennis Club"),
  courtsAvailable: integer("courts_available").notNull().default(3),
  defaultTimeSlot: text("default_time_slot").notNull().default("08:15-09:45"),
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
  emailTestPhone: text("email_test_phone").notNull().default(""),
  emailTestCarrier: text("email_test_carrier").notNull().default(""),
  reminderTemplate: text("reminder_template").notNull().default(
    "Reminder: You have a game tomorrow ({date}) on Court {court} at {time}. Players: {players}"
  ),
  urgentTemplate: text("urgent_template").notNull().default(
    "URGENT: Tomorrow's game ({date}) on Court {court} at {time} needs more players!\n\nCurrently signed up ({count}/{max}): {players}\n\nPlease help find additional players."
  ),
  courtReservationTemplate: text("court_reservation_template").notNull().default(
    "As the first player listed in the game schedule for tomorrow at {time}, this is a reminder to reserve a court and to update the court number in the signup application"
  ),
  overflowLastSignupDate: text("overflow_last_signup_date"),
  dropdownResetSeconds: integer("dropdown_reset_seconds").notNull().default(30),
  // Weather forecast location (Open-Meteo). Defaults to West Orange, NJ (07052).
  weatherZip: text("weather_zip").notNull().default("07052"),
  weatherLat: text("weather_lat").notNull().default("40.7989"),
  weatherLon: text("weather_lon").notNull().default("-74.2390"),
  weatherEnabled: integer("weather_enabled", { mode: "boolean" }).notNull().default(true),
});
