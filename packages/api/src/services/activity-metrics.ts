import { db } from "@trend-x/db";
import { tweet } from "@trend-x/db/schema";
import { asc, eq } from "drizzle-orm";

export interface DynamicActivityMetrics {
  tweetsPerDay: number;
  maxSilenceHours: number;
  windowStart: number;
  windowEnd: number;
  tweetCount: number;
}

/**
 * Compute activity metrics dynamically from the tweets table.
 *
 * Both metrics use the full tweet history (oldest tweet → now) so they
 * stay consistent with the heatmap which also shows all-time data.
 */
export async function getActivityMetrics(accountId: string): Promise<DynamicActivityMetrics> {
  const now = Math.floor(Date.now() / 1000);

  // Fetch ALL tweet timestamps for the account (chronological order)
  const allTweets = await db
    .select({ tweetCreatedAt: tweet.tweetCreatedAt })
    .from(tweet)
    .where(eq(tweet.accountId, accountId))
    .orderBy(asc(tweet.tweetCreatedAt));

  if (allTweets.length === 0) {
    return {
      tweetsPerDay: 0,
      maxSilenceHours: 0,
      windowStart: now,
      windowEnd: now,
      tweetCount: 0,
    };
  }

  const oldest = allTweets[0]!.tweetCreatedAt;
  const spanDays = Math.max(1, (now - oldest) / (24 * 60 * 60));

  // tweetsPerDay: total tweets / span from oldest tweet to now
  const tweetsPerDay = Math.round((allTweets.length / spanDays) * 100) / 100;

  // maxSilenceHours: find the largest gap across ALL tweets
  let maxSilenceSeconds = 0;

  for (let i = 1; i < allTweets.length; i++) {
    const gap = allTweets[i]!.tweetCreatedAt - allTweets[i - 1]!.tweetCreatedAt;
    if (gap > maxSilenceSeconds) maxSilenceSeconds = gap;
  }

  // Include the gap from the most recent tweet to now (captures current silence)
  const gapToNow = now - allTweets[allTweets.length - 1]!.tweetCreatedAt;
  if (gapToNow > maxSilenceSeconds) maxSilenceSeconds = gapToNow;

  return {
    tweetsPerDay,
    maxSilenceHours: Math.round((maxSilenceSeconds / 3600) * 10) / 10,
    windowStart: oldest,
    windowEnd: now,
    tweetCount: allTweets.length,
  };
}
