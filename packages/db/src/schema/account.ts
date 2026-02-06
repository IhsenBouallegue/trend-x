import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const account = sqliteTable("account", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  handle: text("handle").notNull().unique(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  // Fetch tracking fields
  lastFetchedTweetId: text("last_fetched_tweet_id"),
  lastFetchedAt: integer("last_fetched_at"),
  lastFetchError: text("last_fetch_error"),
});
