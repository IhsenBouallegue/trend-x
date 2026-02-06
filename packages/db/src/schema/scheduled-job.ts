import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Scheduled jobs table - stores cron configuration for recurring jobs.
 * Each row represents a scheduled job type with its cron expression and enabled state.
 */
export const scheduledJob = sqliteTable("scheduled_job", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobType: text("job_type").notNull(), // "ingest", "fingerprint", etc.
  cronExpression: text("cron_expression").notNull(), // "0 */6 * * *"
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  label: text("label"), // Human-readable name: "Tweet Fetch"
  lastRunAt: integer("last_run_at"),
  nextRunAt: integer("next_run_at"),
  createdAt: integer("created_at").$defaultFn(() => Math.floor(Date.now() / 1000)),
});
