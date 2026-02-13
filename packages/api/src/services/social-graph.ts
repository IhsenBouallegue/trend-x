import { TwitterClient } from "@steipete/bird";
import type { FollowingResult } from "@steipete/bird";
import { db } from "@trend-x/db";
import {
  account,
  config,
  socialConnection,
  socialSnapshot,
} from "@trend-x/db/schema";
import { and, desc, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SocialConnectionData {
  userId: string;
  username: string;
  displayName: string;
  description: string | null;
  followerCount: number | null;
  followingCount: number | null;
  isBlueVerified: boolean;
  profileImageUrl: string | null;
}

export interface ConnectionDiff {
  added: SocialConnectionData[];
  removed: Array<{ userId: string; username: string }>;
}

export interface SocialSnapshotResult {
  snapshotId: string;
  followingCount: number;
  followerCount: number;
  mutualCount: number;
  followingDiff: ConnectionDiff;
  followersDiff: ConnectionDiff;
  type: "full" | "partial";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// Twitter client
// ---------------------------------------------------------------------------

type FetchFn = (
  userId: string,
  count?: number,
  cursor?: string,
) => Promise<FollowingResult>;

/**
 * Load Twitter credentials from config table and create a TwitterClient.
 * Same pattern as debug-fetch-tweets.ts getClient().
 */
async function getTwitterClient(): Promise<TwitterClient> {
  const [authTokenRow] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, "twitter_auth_token"));

  const [ct0Row] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, "twitter_ct0"));

  if (!authTokenRow?.value || !ct0Row?.value) {
    throw new Error("Missing Twitter credentials in config table");
  }

  return new TwitterClient({
    cookies: {
      authToken: authTokenRow.value,
      ct0: ct0Row.value,
    },
  });
}

// ---------------------------------------------------------------------------
// Paginated fetching
// ---------------------------------------------------------------------------

/**
 * Paginated fetch — always fetches the complete list.
 *
 * @param fetchFn - Bird client method (getFollowing or getFollowers)
 * @param userId - Twitter user ID to fetch connections for
 * @param label - Label for logging ("following" | "followers")
 */
async function fetchAllPaged(
  fetchFn: FetchFn,
  userId: string,
  label: string,
  options?: {
    onProgress?: (detail: string) => Promise<void>;
    checkCancellation?: () => Promise<boolean>;
  },
): Promise<SocialConnectionData[]> {
  const allUsers: SocialConnectionData[] = [];
  const seenIds = new Set<string>();
  let cursor: string | undefined;
  let page = 0;

  while (true) {
    page++;
    console.log(
      `  Fetching ${label} page ${page}${cursor ? ` (cursor: ${cursor.slice(0, 20)}...)` : ""}...`,
    );

    const result = await fetchFn(userId, PAGE_SIZE, cursor);

    if (!result.success) {
      console.error(`  Error fetching ${label}: ${result.error}`);
      break;
    }

    if (!result.users || result.users.length === 0) {
      break;
    }

    for (const u of result.users) {
      if (seenIds.has(u.id)) continue;
      seenIds.add(u.id);
      allUsers.push({
        userId: u.id,
        username: u.username,
        displayName: u.name,
        description: u.description ?? null,
        followerCount: u.followersCount ?? null,
        followingCount: u.followingCount ?? null,
        isBlueVerified: u.isBlueVerified ?? false,
        profileImageUrl: u.profileImageUrl ?? null,
      });
    }

    console.log(
      `  Got ${result.users.length} users (total: ${allUsers.length})`,
    );

    // Cursor termination: nextCursor starts with "0|" or is falsy
    if (!result.nextCursor || result.nextCursor.startsWith("0|")) break;
    cursor = result.nextCursor;

    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));

    // Report progress after each page
    await options?.onProgress?.(`Fetching ${label} page ${page} (${allUsers.length} users so far)`);

    // Check cancellation between pages
    if (await options?.checkCancellation?.()) {
      break;
    }
  }

  return allUsers;
}

// ---------------------------------------------------------------------------
// Diff logic
// ---------------------------------------------------------------------------

/**
 * Compare current fetch against stored active connections.
 * Returns added and removed connections.
 */
function diffConnections(
  currentIds: Set<string>,
  previousIds: Set<string>,
  allCurrent: SocialConnectionData[],
): ConnectionDiff {
  const currentMap = new Map(allCurrent.map((u) => [u.userId, u]));

  const added: SocialConnectionData[] = [];
  for (const id of currentIds) {
    if (!previousIds.has(id)) {
      const user = currentMap.get(id);
      if (user) added.push(user);
    }
  }

  const removed: Array<{ userId: string; username: string }> = [];
  for (const id of previousIds) {
    if (!currentIds.has(id)) {
      removed.push({ userId: id, username: "" }); // Username filled from DB below
    }
  }

  return { added, removed };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Fetch, store, and diff social graph for an account.
 * Main entry point for the social graph service.
 *
 * @param accountId - The account ID from the account table
 */
export async function fetchSocialSnapshot(
  accountId: string,
  options?: {
    onProgress?: (detail: string) => Promise<void>;
    checkCancellation?: () => Promise<boolean>;
  },
): Promise<SocialSnapshotResult> {
  const now = Math.floor(Date.now() / 1000);

  // a. Look up account handle
  const [acct] = await db
    .select({ handle: account.handle })
    .from(account)
    .where(eq(account.id, accountId));

  if (!acct) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const handle = acct.handle.startsWith("@")
    ? acct.handle.slice(1)
    : acct.handle;

  // b. Get Twitter client and resolve userId
  const client = await getTwitterClient();
  console.log(`Resolving @${handle}...`);
  const lookup = await client.getUserIdByUsername(handle);
  if (!lookup.success || !lookup.userId) {
    throw new Error(
      `Could not resolve Twitter user @${handle}: ${lookup.error}`,
    );
  }
  console.log(`User ID: ${lookup.userId}`);

  // c. Load active connections from DB for this account (both directions)
  const activeConnections = await db
    .select({
      userId: socialConnection.userId,
      username: socialConnection.username,
      direction: socialConnection.direction,
    })
    .from(socialConnection)
    .where(
      and(
        eq(socialConnection.accountId, accountId),
        eq(socialConnection.isActive, 1),
      ),
    );

  const knownFollowingIds = new Set<string>();
  const knownFollowerIds = new Set<string>();
  const previousUsernameMap = new Map<string, string>();

  for (const conn of activeConnections) {
    previousUsernameMap.set(conn.userId, conn.username);
    if (conn.direction === "following" || conn.direction === "mutual") {
      knownFollowingIds.add(conn.userId);
    }
    if (conn.direction === "follower" || conn.direction === "mutual") {
      knownFollowerIds.add(conn.userId);
    }
  }

  // d. Fetch following
  console.log(`\n[1/2] Fetching who @${handle} follows...`);
  const followingUsers = await fetchAllPaged(
    client.getFollowing.bind(client),
    lookup.userId,
    "following",
    options,
  );
  console.log(`Total following fetched: ${followingUsers.length}`);

  // e. Fetch followers
  console.log(`\n[2/2] Fetching who follows @${handle}...`);
  const followerUsers = await fetchAllPaged(
    client.getFollowers.bind(client),
    lookup.userId,
    "followers",
    options,
  );
  console.log(`Total followers fetched: ${followerUsers.length}`);

  // f. Compute mutual connections
  const followingUserIds = new Set(followingUsers.map((u) => u.userId));
  const followerUserIds = new Set(followerUsers.map((u) => u.userId));
  const mutualUserIds = new Set(
    [...followingUserIds].filter((id) => followerUserIds.has(id)),
  );

  // g. Diff against previous active connections
  const followingDiff = diffConnections(
    followingUserIds,
    knownFollowingIds,
    followingUsers,
  );
  const followersDiff = diffConnections(
    followerUserIds,
    knownFollowerIds,
    followerUsers,
  );

  // Fill in usernames for removed connections from DB data
  for (const r of followingDiff.removed) {
    r.username = previousUsernameMap.get(r.userId) ?? "";
  }
  for (const r of followersDiff.removed) {
    r.username = previousUsernameMap.get(r.userId) ?? "";
  }

  // h. Update social_connection table (batched transactions for performance)
  await options?.onProgress?.("Saving connections to database...");

  // Build connection arrays for batched upserts
  // Store all directions: every following user gets "following", every follower gets "follower",
  // and mutual users additionally get a "mutual" entry. This keeps following/follower lists complete.
  type ConnEntry = { accountId: string; user: SocialConnectionData; direction: string; now: number };
  const allConnections: ConnEntry[] = [];

  for (const user of followingUsers) {
    allConnections.push({ accountId, user, direction: "following", now });
    if (mutualUserIds.has(user.userId)) {
      allConnections.push({ accountId, user, direction: "mutual", now });
    }
  }

  for (const user of followerUsers) {
    allConnections.push({ accountId, user, direction: "follower", now });
  }

  const totalConnections = allConnections.length;

  // Batch upsert all connections
  const BATCH_SIZE = 100;
  for (let i = 0; i < allConnections.length; i += BATCH_SIZE) {
    const batch = allConnections.slice(i, i + BATCH_SIZE);
    await db.transaction(async (tx) => {
      for (const item of batch) {
        await tx
          .insert(socialConnection)
          .values({
            accountId: item.accountId,
            userId: item.user.userId,
            username: item.user.username,
            displayName: item.user.displayName,
            description: item.user.description,
            followerCount: item.user.followerCount,
            followingCount: item.user.followingCount,
            isBlueVerified: item.user.isBlueVerified ? 1 : 0,
            profileImageUrl: item.user.profileImageUrl,
            direction: item.direction,
            firstSeenAt: item.now,
            lastSeenAt: item.now,
            isActive: 1,
          })
          .onConflictDoUpdate({
            target: [
              socialConnection.accountId,
              socialConnection.userId,
              socialConnection.direction,
            ],
            set: {
              username: item.user.username,
              displayName: item.user.displayName,
              description: item.user.description,
              followerCount: item.user.followerCount,
              followingCount: item.user.followingCount,
              isBlueVerified: item.user.isBlueVerified ? 1 : 0,
              profileImageUrl: item.user.profileImageUrl,
              lastSeenAt: item.now,
              isActive: 1,
              deactivatedAt: null,
            },
          });
      }
    });
    await options?.onProgress?.(`Saved ${Math.min(i + BATCH_SIZE, totalConnections)}/${totalConnections} connections`);
  }

  // Deactivate removed connections (batched)
  const allRemovedIds = [
    ...followingDiff.removed.map((r) => ({ userId: r.userId, directions: ["following", "mutual"] })),
    ...followersDiff.removed.map((r) => ({ userId: r.userId, directions: ["follower", "mutual"] })),
  ];

  if (allRemovedIds.length > 0) {
    for (let i = 0; i < allRemovedIds.length; i += BATCH_SIZE) {
      const batch = allRemovedIds.slice(i, i + BATCH_SIZE);
      await db.transaction(async (tx) => {
        for (const item of batch) {
          for (const direction of item.directions) {
            await tx
              .update(socialConnection)
              .set({ isActive: 0, deactivatedAt: now })
              .where(
                and(
                  eq(socialConnection.accountId, accountId),
                  eq(socialConnection.userId, item.userId),
                  eq(socialConnection.direction, direction),
                ),
              );
          }
        }
      });
    }
  }

  // i. Insert social_snapshot row
  const [snapshotRow] = await db
    .insert(socialSnapshot)
    .values({
      accountId,
      type: "full",
      followingCount: followingUserIds.size,
      followerCount: followerUserIds.size,
      mutualCount: mutualUserIds.size,
      followingAdded: followingDiff.added.length,
      followingRemoved: followingDiff.removed.length,
      followersAdded: followersDiff.added.length,
      followersRemoved: followersDiff.removed.length,
    })
    .returning({ id: socialSnapshot.id });

  console.log(
    `\nSnapshot saved: ${snapshotRow.id}` +
      ` | following: ${followingUserIds.size}, followers: ${followerUserIds.size}, mutual: ${mutualUserIds.size}` +
      ` | +${followingDiff.added.length}/-${followingDiff.removed.length} following` +
      ` | +${followersDiff.added.length}/-${followersDiff.removed.length} followers`,
  );

  // j. Return result
  return {
    snapshotId: snapshotRow.id,
    followingCount: followingUserIds.size,
    followerCount: followerUserIds.size,
    mutualCount: mutualUserIds.size,
    followingDiff,
    followersDiff,
    type: "full",
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Get the most recent social snapshot for an account.
 */
export async function getLatestSnapshot(accountId: string) {
  const [snapshot] = await db
    .select()
    .from(socialSnapshot)
    .where(eq(socialSnapshot.accountId, accountId))
    .orderBy(desc(socialSnapshot.fetchedAt))
    .limit(1);

  return snapshot ?? null;
}

/**
 * Get current active connection counts by direction.
 */
export async function getConnectionStats(accountId: string) {
  const connections = await db
    .select({
      direction: socialConnection.direction,
      userId: socialConnection.userId,
    })
    .from(socialConnection)
    .where(
      and(
        eq(socialConnection.accountId, accountId),
        eq(socialConnection.isActive, 1),
      ),
    );

  let following = 0;
  let followers = 0;
  let mutual = 0;

  for (const conn of connections) {
    switch (conn.direction) {
      case "following":
        following++;
        break;
      case "follower":
        followers++;
        break;
      case "mutual":
        mutual++;
        break;
    }
  }

  return { following, followers, mutual, total: connections.length };
}

/**
 * Get recently changed connections (added or deactivated) for display.
 */
export async function getRecentChanges(
  accountId: string,
  limit: number = 20,
) {
  // Recently added (active, sorted by firstSeenAt desc)
  const recentlyAdded = await db
    .select()
    .from(socialConnection)
    .where(
      and(
        eq(socialConnection.accountId, accountId),
        eq(socialConnection.isActive, 1),
      ),
    )
    .orderBy(desc(socialConnection.firstSeenAt))
    .limit(limit);

  // Recently deactivated (inactive, sorted by deactivatedAt desc)
  const recentlyRemoved = await db
    .select()
    .from(socialConnection)
    .where(
      and(
        eq(socialConnection.accountId, accountId),
        eq(socialConnection.isActive, 0),
      ),
    )
    .orderBy(desc(socialConnection.deactivatedAt))
    .limit(limit);

  return { recentlyAdded, recentlyRemoved };
}
