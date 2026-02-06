import { TwitterClient } from "@steipete/bird";

export interface BirdTweet {
  id: string;
  text: string;
  createdAt: string; // ISO timestamp from Bird
  author: { username: string; name: string };
  authorId: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  conversationId: string;
  inReplyToStatusId?: string;
}

/** Alias for use by ingest router and other consumers. */
export type TweetData = BirdTweet;

export type FetchResult =
  | {
      success: true;
      tweets: BirdTweet[];
      nextCursor?: string;
    }
  | {
      success: false;
      error: string;
      tweets?: BirdTweet[];
      nextCursor?: string;
    };

/**
 * Fetch tweets for a user via Bird library.
 *
 * @param handle - Twitter handle (without @)
 * @param authToken - Twitter auth_token cookie
 * @param ct0 - Twitter ct0 cookie
 * @param options - Optional count for number of tweets per page, and until timestamp for historical fetch
 * @returns FetchResult with success/failure and tweets array
 */
export async function fetchUserTweets(
  handle: string,
  authToken: string,
  ct0: string,
  options?: { count?: number; until?: number },
): Promise<FetchResult> {
  const count = options?.count ?? 50;
  const until = options?.until;

  // Strip @ prefix if present
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  const client = new TwitterClient({
    cookies: {
      authToken,
      ct0,
    },
  });

  try {
    // First, look up the numeric user ID from the handle
    const userLookup = await client.getUserIdByUsername(cleanHandle);
    if (!userLookup.success || !userLookup.userId) {
      return {
        success: false,
        error: userLookup.error || `Could not find user @${cleanHandle}`,
        tweets: [],
      };
    }

    // If no 'until' specified, just fetch a single page
    if (!until) {
      const result = await client.getUserTweets(userLookup.userId, count);

      // Map to our BirdTweet interface
      const tweets: BirdTweet[] = (result.tweets ?? []).map((t) => ({
        id: t.id,
        text: t.text,
        createdAt: t.createdAt ?? new Date().toISOString(),
        author: {
          username: t.author?.username ?? cleanHandle,
          name: t.author?.name ?? cleanHandle,
        },
        authorId: t.authorId ?? "",
        likeCount: t.likeCount ?? 0,
        retweetCount: t.retweetCount ?? 0,
        replyCount: t.replyCount ?? 0,
        conversationId: t.conversationId ?? t.id,
        inReplyToStatusId: t.inReplyToStatusId,
      }));

      return {
        success: true,
        tweets,
        nextCursor: result.nextCursor,
      };
    }

    // Use paginated fetch for historical data (with 'until' timestamp)
    // Calculate max pages needed: ~50 tweets per page, estimate 10 tweets/day, fetch up to 1 year
    const maxPages = 100; // Allow up to 5000 tweets (100 pages * 50 tweets)
    const result = await client.getUserTweetsPaged(userLookup.userId, count, {
      maxPages,
      pageDelayMs: 1000, // 1 second delay between pages to avoid rate limits
    });

    // Map to our BirdTweet interface
    const allTweets: BirdTweet[] = (result.tweets ?? []).map((t) => ({
      id: t.id,
      text: t.text,
      createdAt: t.createdAt ?? new Date().toISOString(),
      author: {
        username: t.author?.username ?? cleanHandle,
        name: t.author?.name ?? cleanHandle,
      },
      authorId: t.authorId ?? "",
      likeCount: t.likeCount ?? 0,
      retweetCount: t.retweetCount ?? 0,
      replyCount: t.replyCount ?? 0,
      conversationId: t.conversationId ?? t.id,
      inReplyToStatusId: t.inReplyToStatusId,
    }));

    // Filter tweets to only those within the 'until' window
    const filteredTweets = allTweets.filter((t) => {
      const timestamp = Math.floor(new Date(t.createdAt).getTime() / 1000);
      return timestamp >= until;
    });

    return {
      success: true,
      tweets: filteredTweets,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error fetching tweets";

    return {
      success: false,
      error: errorMessage,
      tweets: [],
    };
  }
}

/**
 * Filter out retweets and replies, keeping only original tweets.
 *
 * Per CONTEXT.md:
 * - Exclude retweets: text starts with "RT @"
 * - Exclude replies: has inReplyToStatusId OR conversationId !== id
 *
 * @param tweets - Array of BirdTweet objects
 * @returns Filtered array containing only original tweets
 */
export function filterOriginalTweets(tweets: BirdTweet[]): BirdTweet[] {
  return tweets.filter((t) => {
    // Exclude replies (has inReplyToStatusId or conversationId differs from id)
    if (t.inReplyToStatusId) return false;
    if (t.conversationId !== t.id) return false;

    // Exclude retweets (text starts with "RT @")
    if (t.text.startsWith("RT @")) return false;

    return true;
  });
}
