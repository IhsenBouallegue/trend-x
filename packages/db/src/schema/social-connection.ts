import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { account } from "./account";

/**
 * Social connection - individual follower/following records with active/inactive tracking.
 * Each row represents one directional connection between the monitored account and a Twitter user.
 * Composite unique index on (accountId, userId, direction) prevents duplicates.
 */
export const socialConnection = sqliteTable(
  "social_connection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Twitter user ID of connected user
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"), // nullable
    followerCount: integer("follower_count"), // nullable, their follower count
    followingCount: integer("following_count"), // nullable, their following count
    isBlueVerified: integer("is_blue_verified"), // nullable, 0 or 1
    profileImageUrl: text("profile_image_url"), // nullable
    direction: text("direction").notNull(), // "following" | "follower" | "mutual"
    firstSeenAt: integer("first_seen_at").notNull(), // unix timestamp
    lastSeenAt: integer("last_seen_at").notNull(), // unix timestamp
    isActive: integer("is_active").notNull().default(1), // 0 = connection lost, 1 = current
    deactivatedAt: integer("deactivated_at"), // nullable, when connection was lost
  },
  (table) => [
    uniqueIndex("social_connection_account_user_direction_idx").on(
      table.accountId,
      table.userId,
      table.direction,
    ),
  ],
);
