import { db } from "@trend-x/db";
import { tweet } from "@trend-x/db/schema";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

export const tweetRouter = router({
  /**
   * Get tweets by their IDs.
   * Used to fetch sample tweets for topic expansion.
   */
  getByIds: publicProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.ids.length === 0) return [];
      const tweets = await db.select().from(tweet).where(inArray(tweet.id, input.ids));
      return tweets;
    }),

  /**
   * Get tweets for a specific date (YYYY-MM-DD in UTC).
   */
  getByDate: publicProcedure
    .input(z.object({ accountId: z.string(), date: z.string() }))
    .query(async ({ input }) => {
      const dayStart = Math.floor(new Date(`${input.date}T00:00:00Z`).getTime() / 1000);
      const dayEnd = dayStart + 86400;

      const tweets = await db
        .select()
        .from(tweet)
        .where(
          and(
            eq(tweet.accountId, input.accountId),
            gte(tweet.tweetCreatedAt, dayStart),
            lt(tweet.tweetCreatedAt, dayEnd),
          ),
        );

      return tweets;
    }),

  /**
   * Get daily tweet counts for calendar heatmap.
   * Returns array of { date: string (YYYY-MM-DD), count: number }
   * for the last 365 days (or all tweets if less).
   */
  getActivityCalendar: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      // Get all tweets for account
      const tweets = await db
        .select({
          tweetCreatedAt: tweet.tweetCreatedAt,
        })
        .from(tweet)
        .where(eq(tweet.accountId, input.accountId));

      // Aggregate by date (YYYY-MM-DD in UTC)
      const countByDate = new Map<string, number>();

      for (const t of tweets) {
        const date = new Date(t.tweetCreatedAt * 1000);
        const dateStr = date.toISOString().split("T")[0]!;
        countByDate.set(dateStr, (countByDate.get(dateStr) || 0) + 1);
      }

      // Convert to array sorted by date
      const result = Array.from(countByDate.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return result;
    }),

});
