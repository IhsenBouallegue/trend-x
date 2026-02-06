import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { account } from "./account";

/**
 * Profile activity log - records all profile update actions for transparency.
 * Human-readable messages explain what changed and why.
 */
export const profileActivityLog = sqliteTable("profile_activity_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(), // 'tweets_classified' | 'profile_updated' | 'new_topic_detected' | 'personality_evaluated' | 'drift_buffer_processed'
  message: text("message").notNull(), // Human-readable: "5 tweets classified into 3 topics"
  metadata: text("metadata"), // JSON: {tweetCount, topicsAffected, etc}
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
