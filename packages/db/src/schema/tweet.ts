import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { account } from "./account";

export const tweet = sqliteTable("tweet", {
  id: text("id").primaryKey(), // Twitter's tweet ID - NOT UUID
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  tweetCreatedAt: integer("tweet_created_at").notNull(), // Unix timestamp from tweet
  likeCount: integer("like_count").notNull().default(0),
  retweetCount: integer("retweet_count").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  rawJson: text("raw_json"), // Full Bird CLI response for this tweet
  fetchedAt: integer("fetched_at").notNull(), // When we fetched it
  // Tweet type flags for fingerprint weighting
  isRetweet: integer("is_retweet").notNull().default(0), // 0 or 1 boolean flag
  isReply: integer("is_reply").notNull().default(0), // 0 or 1 boolean flag
  isQuoteTweet: integer("is_quote_tweet").notNull().default(0), // 0 or 1 boolean flag
});
