import { db } from "@trend-x/db";
import { account, config, tweet } from "@trend-x/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { fetchUserTweets, filterOriginalTweets, type TweetData } from "../services/bird";

/**
 * Extract tweet type flags from rawJson.
 * Works for both new tweets and backfilling existing tweets.
 */
function extractTweetTypeFlags(rawJson: unknown): {
  isRetweet: 0 | 1;
  isReply: 0 | 1;
  isQuoteTweet: 0 | 1;
} {
  const json =
    typeof rawJson === "string" ? JSON.parse(rawJson) : (rawJson as Record<string, unknown> | null);

  // Retweet: check retweeted_status or RT @ prefix
  const text = (json?.text as string) ?? "";
  const isRetweet = json?.retweeted_status || text.startsWith("RT @") ? 1 : 0;

  // Reply: check in_reply_to_status_id or inReplyToStatusId (Bird format)
  const isReply = json?.in_reply_to_status_id || json?.inReplyToStatusId ? 1 : 0;

  // Quote tweet: check quoted_status or is_quote_status
  const isQuoteTweet = json?.quoted_status || json?.is_quote_status ? 1 : 0;

  return {
    isRetweet: isRetweet as 0 | 1,
    isReply: isReply as 0 | 1,
    isQuoteTweet: isQuoteTweet as 0 | 1,
  };
}

/**
 * Get Twitter credentials from config table.
 * Throws if credentials are missing or empty.
 */
async function getCredentials(): Promise<{ authToken: string; ct0: string }> {
  const [authTokenRow] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, "twitter_auth_token"));

  const [ct0Row] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, "twitter_ct0"));

  const authToken = authTokenRow?.value;
  const ct0 = ct0Row?.value;

  if (!authToken || authToken.trim() === "") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Twitter auth_token not configured",
    });
  }

  if (!ct0 || ct0.trim() === "") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Twitter ct0 not configured",
    });
  }

  return { authToken, ct0 };
}

/**
 * Store tweets in database with upsert (update engagement counts on conflict).
 */
async function storeTweets(accountId: string, tweets: TweetData[]): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  for (const t of tweets) {
    // Parse ISO timestamp to Unix timestamp (default to now if missing)
    const tweetCreatedAt = t.createdAt ? Math.floor(new Date(t.createdAt).getTime() / 1000) : now;

    // Extract tweet type flags from raw data
    const flags = extractTweetTypeFlags(t);

    await db
      .insert(tweet)
      .values({
        id: t.id,
        accountId,
        text: t.text,
        tweetCreatedAt,
        likeCount: t.likeCount ?? 0,
        retweetCount: t.retweetCount ?? 0,
        replyCount: t.replyCount ?? 0,
        rawJson: JSON.stringify(t),
        fetchedAt: now,
        isRetweet: flags.isRetweet,
        isReply: flags.isReply,
        isQuoteTweet: flags.isQuoteTweet,
      })
      .onConflictDoUpdate({
        target: tweet.id,
        set: {
          likeCount: t.likeCount ?? 0,
          retweetCount: t.retweetCount ?? 0,
          replyCount: t.replyCount ?? 0,
          rawJson: JSON.stringify(t),
          fetchedAt: now,
          isRetweet: flags.isRetweet,
          isReply: flags.isReply,
          isQuoteTweet: flags.isQuoteTweet,
        },
      });
  }
}

/**
 * Core fetch and store logic for a single account.
 * Exported for use by scheduler service.
 */
export async function fetchAndStoreTweetsForAccount(
  accountId: string,
): Promise<{ success: boolean; count: number }> {
  // Get account
  const [acc] = await db.select().from(account).where(eq(account.id, accountId));

  if (!acc) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Account ${accountId} not found`,
    });
  }

  // Get credentials
  const { authToken, ct0 } = await getCredentials();

  // Determine if initial fetch (no lastFetchedTweetId means first time)
  const isInitial = !acc.lastFetchedTweetId;

  let result;
  if (isInitial) {
    // Initial scrape: Fetch tweets going back 1 year (time-bounded)
    const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;

    result = await fetchUserTweets(acc.handle, authToken, ct0, {
      count: 100, // per page
      until: oneYearAgo, // stop when tweets are older than this
    });
  } else {
    // Ongoing fetch: just get recent tweets
    result = await fetchUserTweets(acc.handle, authToken, ct0, {
      count: 50,
    });
  }

  // Handle fetch failure
  if (!result.success) {
    await db
      .update(account)
      .set({
        lastFetchError: result.error,
      })
      .where(eq(account.id, accountId));

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to fetch tweets: ${result.error}`,
    });
  }

  const tweetsToStore = filterOriginalTweets(result.tweets);

  // Store tweets
  await storeTweets(accountId, tweetsToStore);

  // Update account tracking fields
  const now = Math.floor(Date.now() / 1000);
  const firstTweet = result.tweets[0];
  const mostRecentTweetId = firstTweet?.id ?? acc.lastFetchedTweetId;

  await db
    .update(account)
    .set({
      lastFetchedTweetId: mostRecentTweetId,
      lastFetchedAt: now,
      lastFetchError: null,
    })
    .where(eq(account.id, accountId));

  return { success: true, count: tweetsToStore.length };
}

export const ingestRouter = router({
  fetchTweets: publicProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return fetchAndStoreTweetsForAccount(input.accountId);
    }),

  getLastFetchStatus: publicProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const [acc] = await db
        .select({
          lastFetchedTweetId: account.lastFetchedTweetId,
          lastFetchedAt: account.lastFetchedAt,
          lastFetchError: account.lastFetchError,
        })
        .from(account)
        .where(eq(account.id, input.accountId));

      if (!acc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Account ${input.accountId} not found`,
        });
      }

      return acc;
    }),

  /**
   * Backfill isRetweet/isReply/isQuoteTweet for existing tweets.
   * Reads rawJson and updates flags for all tweets of an account.
   */
  backfillTweetTypeFlags: publicProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const tweets = await db
        .select({ id: tweet.id, rawJson: tweet.rawJson })
        .from(tweet)
        .where(eq(tweet.accountId, input.accountId));

      let updated = 0;
      for (const t of tweets) {
        const flags = extractTweetTypeFlags(t.rawJson);
        await db.update(tweet).set(flags).where(eq(tweet.id, t.id));
        updated++;
      }

      return { updated };
    }),
});
