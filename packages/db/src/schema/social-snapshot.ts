import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { account } from "./account";

/**
 * Social snapshot - metadata per social graph fetch run.
 * Records summary stats and diff counts for each follower/following fetch.
 */
export const socialSnapshot = sqliteTable("social_snapshot", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "full" | "partial" (partial = stopped early)
  followingCount: integer("following_count").notNull(),
  followerCount: integer("follower_count").notNull(),
  mutualCount: integer("mutual_count").notNull(),
  followingAdded: integer("following_added").notNull().default(0),
  followingRemoved: integer("following_removed").notNull().default(0),
  followersAdded: integer("followers_added").notNull().default(0),
  followersRemoved: integer("followers_removed").notNull().default(0),
  fetchedAt: integer("fetched_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
