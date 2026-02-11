import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { pipelineRun } from "./pipeline-run";

/**
 * Pipeline step record - tracks individual stage progress within a pipeline run.
 * One row per step per run (fetching, embedding, clustering, etc.).
 */
export const pipelineStep = sqliteTable("pipeline_step", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id")
    .notNull()
    .references(() => pipelineRun.id, { onDelete: "cascade" }),
  stepName: text("step_name").notNull(), // matches state machine stage names
  stepOrder: integer("step_order").notNull(), // 1, 2, 3... for ordering
  status: text("status").notNull(), // "pending" | "running" | "completed" | "skipped" | "failed"
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
  durationMs: integer("duration_ms"), // computed on completion as (completedAt - startedAt) * 1000, null while running/pending
  resultSummary: text("result_summary"), // JSON: e.g., '{"tweetCount": 142}'
  progressDetail: text("progress_detail"), // Live progress text e.g. "Fetching following page 3 (450 users)"
  errorMessage: text("error_message"),
});
