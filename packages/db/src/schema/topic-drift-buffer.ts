import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { account } from "./account";
import { tweet } from "./tweet";

/**
 * Topic drift buffer - holds unmatched tweet embeddings awaiting re-clustering.
 * When a tweet doesn't match any existing topic (low cosine similarity),
 * it goes here until enough accumulate for a new topic to emerge.
 */
export const topicDriftBuffer = sqliteTable("topic_drift_buffer", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  tweetId: text("tweet_id")
    .notNull()
    .references(() => tweet.id, { onDelete: "cascade" }),
  embedding: text("embedding").notNull(), // JSON-encoded vector
  addedAt: integer("added_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
