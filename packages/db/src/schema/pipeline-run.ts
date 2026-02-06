import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { account } from "./account";

/**
 * Pipeline run record - tracks overall pipeline execution for an account.
 * One row per pipeline run (profile update or tweet ingestion).
 */
export const pipelineRun = sqliteTable("pipeline_run", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  pipelineType: text("pipeline_type").notNull(), // "profile_update" | "ingest"
  status: text("status").notNull(), // "queued" | "running" | "completed" | "failed" | "cancelled"
  startedAt: integer("started_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  completedAt: integer("completed_at"), // null while running
  cancelledAt: integer("cancelled_at"), // for cooperative cancellation, null means not cancelled
  currentStage: text("current_stage"), // denormalized for fast polling, null when queued or completed
  input: text("input"), // JSON string of job input, null for backward compatibility with old rows
  errorMessage: text("error_message"), // populated on failure
  errorStep: text("error_step"), // which step failed
  resultSummary: text("result_summary"), // JSON string with overall run summary like tweetCount, topicCount, changesDetected
});
