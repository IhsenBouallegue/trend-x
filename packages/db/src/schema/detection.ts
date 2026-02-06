import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { account } from "./account";

/**
 * Change detection run record - one row per detection run per account.
 * Tracks when detection was performed and how many changes were found.
 * Legacy table from fingerprint-based detection. Kept for notification FK references.
 */
export const changeDetectionRun = sqliteTable("change_detection_run", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  fingerprintId: text("fingerprint_id"), // Legacy: was FK to fingerprint table
  previousFingerprintId: text("previous_fingerprint_id"), // null for baseline runs
  isBaseline: integer("is_baseline").notNull().default(0), // 1 = first fingerprint, no comparison done
  changeCount: integer("change_count").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

/**
 * Individual detected change - one row per change found in a detection run.
 * Stores the change type, dimension, LLM explanation, and evidence.
 */
export const detectedChange = sqliteTable("detected_change", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id")
    .notNull()
    .references(() => changeDetectionRun.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "topic_new" | "topic_drop" | "sentiment_shift" | "activity_spike" | "activity_drop" | "silence"
  dimension: text("dimension").notNull(), // human-readable dimension label
  explanation: text("explanation").notNull(), // LLM-generated explanation
  beforeValue: text("before_value"), // JSON-encoded before value (null for new topics)
  afterValue: text("after_value").notNull(), // JSON-encoded after value
  evidence: text("evidence"), // JSON object with { tweetIds: string[], metadata?: Record<string, unknown> }
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
