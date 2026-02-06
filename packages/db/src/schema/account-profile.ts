import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { account } from "./account";

/**
 * Account profile - denormalized live profile for each monitored account.
 * Stores topics, personality, and activity metrics as JSON columns
 * for incremental evolution instead of batch fingerprinting.
 */
export const accountProfile = sqliteTable("account_profile", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" })
    .unique(),

  // Topics: JSON array of {id, label, centroid, proportion, tweetCount, sentiment}
  topics: text("topics").notNull().default("[]"),

  // Personality: JSON {scores: {formal, technical, provocative, thoughtLeader, commentator, curator, promoter}, values: string[], summary: string}
  personality: text("personality").notNull().default("{}"),

  // Activity metrics: JSON {tweetsPerDay, maxSilenceHours, windowStart, windowEnd}
  activityMetrics: text("activity_metrics").notNull().default("{}"),

  // Baselines for drift detection (snapshot at last major evaluation)
  personalityBaseline: text("personality_baseline"), // JSON - same structure as personality, null until first evaluation

  // Counters
  totalTweetsProcessed: integer("total_tweets_processed")
    .notNull()
    .default(0),
  lastPersonalityEvalAt: integer("last_personality_eval_at"), // Unix timestamp, null until first evaluation

  // Timestamps
  lastUpdatedAt: integer("last_updated_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
