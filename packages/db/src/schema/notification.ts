import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { account } from "./account";
import { changeDetectionRun, detectedChange } from "./detection";

/**
 * Notification record - one row per detected change that should be surfaced to the user.
 * Created automatically when changes are detected during fingerprint or profile analysis.
 * detectionRunId and changeId are nullable to support profile-based detection
 * which doesn't produce fingerprint detection runs.
 */
export const notification = sqliteTable("notification", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  detectionRunId: text("detection_run_id")
    .references(() => changeDetectionRun.id, { onDelete: "cascade" }),
  changeId: text("change_id")
    .references(() => detectedChange.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // e.g., "New Topic: AI Regulation"
  explanation: text("explanation").notNull(), // 1-2 sentence LLM explanation
  changeType: text("change_type").notNull(), // "topic_new" | "topic_drop" | "sentiment_shift" | "activity_spike" | "activity_drop" | "silence" | "personality_drift" | "topic_emergence" | "topic_abandonment" | "activity_anomaly"
  isRead: integer("is_read").notNull().default(0), // 0=unread, 1=read
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  readAt: integer("read_at"), // null until marked as read
});
