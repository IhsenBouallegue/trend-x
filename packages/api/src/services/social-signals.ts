import { db } from "@trend-x/db";
import { account, notification, socialConnection } from "@trend-x/db/schema";
import { and, eq, gte, or } from "drizzle-orm";
import type { SocialSnapshotResult } from "./social-graph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SocialChangeType =
  | "follower_spike"
  | "follower_drop"
  | "notable_follower_gained"
  | "notable_follower_lost"
  | "new_mutual_connection"
  | "following_spike";

export interface DetectedSocialChange {
  type: SocialChangeType;
  dimension: string;
  explanation: string;
  beforeValue: string | number | null;
  afterValue: string | number;
  metadata: Record<string, unknown>;
}

export interface SocialDetectionResult {
  accountId: string;
  isBaseline: boolean;
  changes: DetectedSocialChange[];
  notificationIds: string[];
}

interface PreviousSnapshot {
  followerCount: number;
  followingCount: number;
}

// ---------------------------------------------------------------------------
// Notable thresholds
// ---------------------------------------------------------------------------

const NOTABLE_FOLLOWER_THRESHOLD = 10000;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Detect social signals from a social snapshot result.
 * Analyzes follower count changes, notable follower gains/losses,
 * new mutual connections, and following spikes.
 *
 * @param accountId - The account to detect changes for
 * @param snapshotResult - Current snapshot data from fetchSocialSnapshot
 * @param previousSnapshot - Previous counts for comparison (null = baseline)
 * @returns Detection result with changes and notification IDs
 */
export async function detectSocialSignals(
  accountId: string,
  snapshotResult: SocialSnapshotResult,
  previousSnapshot: PreviousSnapshot | null,
): Promise<SocialDetectionResult> {
  // If no previous snapshot, this is a baseline run
  if (!previousSnapshot) {
    return {
      accountId,
      isBaseline: true,
      changes: [],
      notificationIds: [],
    };
  }

  // 24h repeat suppression
  const suppressedKeys = await getRecentlySuppressedSocialKeys(accountId);

  const changes: DetectedSocialChange[] = [];

  // 1. Follower spike/drop detection
  const followerChanges = detectFollowerChanges(
    snapshotResult.followerCount,
    previousSnapshot.followerCount,
    suppressedKeys,
  );
  changes.push(...followerChanges);

  // 2. Following spike detection
  const followingChanges = detectFollowingSpike(
    snapshotResult.followingCount,
    previousSnapshot.followingCount,
    suppressedKeys,
  );
  changes.push(...followingChanges);

  // 3. Notable follower gained
  const notableGains = detectNotableFollowerGained(
    snapshotResult.followersDiff.added,
    suppressedKeys,
  );
  changes.push(...notableGains);

  // 4. Notable follower lost
  const notableLosses = await detectNotableFollowerLost(
    accountId,
    snapshotResult.followersDiff.removed,
    suppressedKeys,
  );
  changes.push(...notableLosses);

  // 5. New mutual connections
  const mutualChanges = await detectNewMutualConnections(
    accountId,
    snapshotResult,
    suppressedKeys,
  );
  changes.push(...mutualChanges);

  // If no changes, return early
  if (changes.length === 0) {
    return {
      accountId,
      isBaseline: false,
      changes: [],
      notificationIds: [],
    };
  }

  // Generate template-based explanations (no LLM call for social signals)
  const changesWithExplanations = changes.map((change) => ({
    ...change,
    explanation: generateSocialExplanation(change),
  }));

  // Create notification records
  const notificationIds = await createSocialNotifications(
    accountId,
    changesWithExplanations,
  );

  return {
    accountId,
    isBaseline: false,
    changes: changesWithExplanations,
    notificationIds,
  };
}

// ---------------------------------------------------------------------------
// Repeat suppression
// ---------------------------------------------------------------------------

/**
 * Get set of changeType:dimension keys that have been notified within 24 hours.
 * Follows the exact pattern from profile-detection.ts getRecentlySuppressedKeys.
 */
async function getRecentlySuppressedSocialKeys(
  accountId: string,
): Promise<Set<string>> {
  const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

  const socialChangeTypes: SocialChangeType[] = [
    "follower_spike",
    "follower_drop",
    "notable_follower_gained",
    "notable_follower_lost",
    "new_mutual_connection",
    "following_spike",
  ];

  const recentNotifications = await db
    .select({
      changeType: notification.changeType,
      title: notification.title,
    })
    .from(notification)
    .where(
      and(
        eq(notification.accountId, accountId),
        gte(notification.createdAt, twentyFourHoursAgo),
      ),
    );

  const suppressed = new Set<string>();
  for (const n of recentNotifications) {
    // Only track social change types for suppression
    if (socialChangeTypes.includes(n.changeType as SocialChangeType)) {
      const dimension = extractDimensionFromSocialTitle(n.title, n.changeType);
      suppressed.add(`${n.changeType}:${dimension}`);
    }
  }

  return suppressed;
}

/**
 * Extract dimension from notification title for suppression matching.
 */
function extractDimensionFromSocialTitle(
  title: string,
  changeType: string,
): string {
  // For follower/following count changes, dimension is the metric name
  if (
    changeType === "follower_spike" ||
    changeType === "follower_drop" ||
    changeType === "following_spike"
  ) {
    return "count";
  }

  // For user-specific changes, extract the @username from title
  // Formats: "Notable New Follower: @username", "New Mutual Connection: @username"
  const colonIdx = title.indexOf(": @");
  if (colonIdx >= 0) {
    return title.substring(colonIdx + 2); // includes the @
  }

  const colonIdx2 = title.indexOf(": ");
  if (colonIdx2 >= 0) {
    return title.substring(colonIdx2 + 2);
  }

  return title;
}

// ---------------------------------------------------------------------------
// Follower spike/drop detection
// ---------------------------------------------------------------------------

/**
 * Detect follower count spike (>20% increase) or drop (>20% decrease).
 * Uses stricter thresholds than profile detection because follower counts
 * change more gradually.
 */
function detectFollowerChanges(
  currentCount: number,
  previousCount: number,
  suppressedKeys: Set<string>,
): DetectedSocialChange[] {
  const changes: DetectedSocialChange[] = [];

  if (previousCount === 0) return changes;

  // Follower spike: current > previous * 1.2 (strict >)
  if (
    currentCount > previousCount * 1.2 &&
    !suppressedKeys.has("follower_spike:count")
  ) {
    const percentChange = Math.round(
      ((currentCount - previousCount) / previousCount) * 100,
    );
    changes.push({
      type: "follower_spike",
      dimension: "count",
      explanation: "", // Filled later
      beforeValue: previousCount,
      afterValue: currentCount,
      metadata: { percentChange, ratio: currentCount / previousCount },
    });
  }

  // Follower drop: previous > current * 1.2 (strict >)
  if (
    previousCount > currentCount * 1.2 &&
    !suppressedKeys.has("follower_drop:count")
  ) {
    const percentChange = Math.round(
      ((previousCount - currentCount) / previousCount) * 100,
    );
    changes.push({
      type: "follower_drop",
      dimension: "count",
      explanation: "", // Filled later
      beforeValue: previousCount,
      afterValue: currentCount,
      metadata: { percentChange, ratio: previousCount / currentCount },
    });
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Following spike detection
// ---------------------------------------------------------------------------

/**
 * Detect following count spike (>30% increase).
 * Mass-following is unusual and noteworthy.
 */
function detectFollowingSpike(
  currentCount: number,
  previousCount: number,
  suppressedKeys: Set<string>,
): DetectedSocialChange[] {
  const changes: DetectedSocialChange[] = [];

  if (previousCount === 0) return changes;

  // Following spike: current > previous * 1.3 (strict >)
  if (
    currentCount > previousCount * 1.3 &&
    !suppressedKeys.has("following_spike:count")
  ) {
    const percentChange = Math.round(
      ((currentCount - previousCount) / previousCount) * 100,
    );
    changes.push({
      type: "following_spike",
      dimension: "count",
      explanation: "", // Filled later
      beforeValue: previousCount,
      afterValue: currentCount,
      metadata: { percentChange, ratio: currentCount / previousCount },
    });
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Notable follower gained
// ---------------------------------------------------------------------------

/**
 * Detect notable new followers (blue verified or >10k followers).
 * Creates one change per notable follower gained.
 */
function detectNotableFollowerGained(
  addedFollowers: SocialSnapshotResult["followersDiff"]["added"],
  suppressedKeys: Set<string>,
): DetectedSocialChange[] {
  const changes: DetectedSocialChange[] = [];

  for (const user of addedFollowers) {
    const isNotable =
      user.isBlueVerified ||
      (user.followerCount !== null &&
        user.followerCount > NOTABLE_FOLLOWER_THRESHOLD);

    if (!isNotable) continue;

    const suppressKey = `notable_follower_gained:@${user.username}`;
    if (suppressedKeys.has(suppressKey)) continue;

    const verifiedStatus = user.isBlueVerified ? "verified" : "unverified";
    changes.push({
      type: "notable_follower_gained",
      dimension: `@${user.username}`,
      explanation: "", // Filled later
      beforeValue: null,
      afterValue: user.followerCount ?? 0,
      metadata: {
        userId: user.userId,
        username: user.username,
        displayName: user.displayName,
        followerCount: user.followerCount,
        isBlueVerified: user.isBlueVerified,
        verifiedStatus,
      },
    });
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Notable follower lost
// ---------------------------------------------------------------------------

/**
 * Detect notable follower losses.
 * Check social_connection table for stored data before deactivation:
 * isBlueVerified=1 or followerCount > 10000.
 */
async function detectNotableFollowerLost(
  accountId: string,
  removedFollowers: Array<{ userId: string; username: string }>,
  suppressedKeys: Set<string>,
): Promise<DetectedSocialChange[]> {
  const changes: DetectedSocialChange[] = [];

  for (const removed of removedFollowers) {
    const suppressKey = `notable_follower_lost:@${removed.username}`;
    if (suppressedKeys.has(suppressKey)) continue;

    // Look up the stored connection data for this user
    const [storedConn] = await db
      .select({
        followerCount: socialConnection.followerCount,
        isBlueVerified: socialConnection.isBlueVerified,
        displayName: socialConnection.displayName,
      })
      .from(socialConnection)
      .where(
        and(
          eq(socialConnection.accountId, accountId),
          eq(socialConnection.userId, removed.userId),
        ),
      )
      .limit(1);

    if (!storedConn) continue;

    const isNotable =
      storedConn.isBlueVerified === 1 ||
      (storedConn.followerCount !== null &&
        storedConn.followerCount > NOTABLE_FOLLOWER_THRESHOLD);

    if (!isNotable) continue;

    changes.push({
      type: "notable_follower_lost",
      dimension: `@${removed.username}`,
      explanation: "", // Filled later
      beforeValue: storedConn.followerCount ?? 0,
      afterValue: 0,
      metadata: {
        userId: removed.userId,
        username: removed.username,
        displayName: storedConn.displayName,
        followerCount: storedConn.followerCount,
        isBlueVerified: storedConn.isBlueVerified === 1,
      },
    });
  }

  return changes;
}

// ---------------------------------------------------------------------------
// New mutual connections
// ---------------------------------------------------------------------------

/**
 * Detect new mutual connections that are notable or are monitored accounts.
 * A mutual = user appears in both followingDiff.added AND is already a follower,
 * or vice versa.
 */
async function detectNewMutualConnections(
  accountId: string,
  snapshotResult: SocialSnapshotResult,
  suppressedKeys: Set<string>,
): Promise<DetectedSocialChange[]> {
  const changes: DetectedSocialChange[] = [];

  // Get active follower user IDs (direction = "follower" or "mutual")
  const activeFollowers = await db
    .select({ userId: socialConnection.userId })
    .from(socialConnection)
    .where(
      and(
        eq(socialConnection.accountId, accountId),
        eq(socialConnection.isActive, 1),
        or(
          eq(socialConnection.direction, "follower"),
          eq(socialConnection.direction, "mutual"),
        ),
      ),
    );

  const followerUserIds = new Set(activeFollowers.map((f) => f.userId));

  // Users newly followed who are already followers = new mutual
  const newMutuals: Array<{
    userId: string;
    username: string;
    displayName: string;
    followerCount: number | null;
    isBlueVerified: boolean;
  }> = [];

  for (const added of snapshotResult.followingDiff.added) {
    if (followerUserIds.has(added.userId)) {
      newMutuals.push({
        userId: added.userId,
        username: added.username,
        displayName: added.displayName,
        followerCount: added.followerCount,
        isBlueVerified: added.isBlueVerified,
      });
    }
  }

  // Also check followers added who were already being followed (direction = "following" or "mutual")
  const activeFollowing = await db
    .select({ userId: socialConnection.userId })
    .from(socialConnection)
    .where(
      and(
        eq(socialConnection.accountId, accountId),
        eq(socialConnection.isActive, 1),
        or(
          eq(socialConnection.direction, "following"),
          eq(socialConnection.direction, "mutual"),
        ),
      ),
    );
  const followingUserIds = new Set(activeFollowing.map((f) => f.userId));

  for (const added of snapshotResult.followersDiff.added) {
    if (
      followingUserIds.has(added.userId) &&
      !newMutuals.some((m) => m.userId === added.userId)
    ) {
      newMutuals.push({
        userId: added.userId,
        username: added.username,
        displayName: added.displayName,
        followerCount: added.followerCount,
        isBlueVerified: added.isBlueVerified,
      });
    }
  }

  // Get monitored account handles for checking if mutual is a tracked account
  const monitoredAccounts = await db
    .select({ handle: account.handle })
    .from(account);
  const monitoredHandles = new Set(
    monitoredAccounts.map((a) =>
      a.handle.startsWith("@") ? a.handle.slice(1).toLowerCase() : a.handle.toLowerCase(),
    ),
  );

  for (const mutual of newMutuals) {
    const suppressKey = `new_mutual_connection:@${mutual.username}`;
    if (suppressedKeys.has(suppressKey)) continue;

    // Only flag if notable OR is a monitored account
    const isNotable =
      mutual.isBlueVerified ||
      (mutual.followerCount !== null &&
        mutual.followerCount > NOTABLE_FOLLOWER_THRESHOLD);
    const isMonitored = monitoredHandles.has(mutual.username.toLowerCase());

    if (!isNotable && !isMonitored) continue;

    changes.push({
      type: "new_mutual_connection",
      dimension: `@${mutual.username}`,
      explanation: "", // Filled later
      beforeValue: null,
      afterValue: mutual.followerCount ?? 0,
      metadata: {
        userId: mutual.userId,
        username: mutual.username,
        displayName: mutual.displayName,
        followerCount: mutual.followerCount,
        isBlueVerified: mutual.isBlueVerified,
        isMonitoredAccount: isMonitored,
      },
    });
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Explanation generation (template-based, no LLM)
// ---------------------------------------------------------------------------

/**
 * Generate template-based explanation for a social change.
 * No LLM call for social signals - keep it fast.
 */
function generateSocialExplanation(change: DetectedSocialChange): string {
  switch (change.type) {
    case "follower_spike": {
      const percent = change.metadata.percentChange as number;
      return `Follower count increased from ${change.beforeValue} to ${change.afterValue} (+${percent}%)`;
    }
    case "follower_drop": {
      const percent = change.metadata.percentChange as number;
      return `Follower count decreased from ${change.beforeValue} to ${change.afterValue} (-${percent}%)`;
    }
    case "notable_follower_gained": {
      const followerCount = change.metadata.followerCount as number | null;
      const verifiedStatus = change.metadata.verifiedStatus as string;
      const followerStr =
        followerCount !== null ? `${followerCount.toLocaleString()} followers` : "unknown followers";
      return `${change.dimension} (${followerStr}, ${verifiedStatus}) started following this account`;
    }
    case "notable_follower_lost": {
      return `${change.dimension} unfollowed this account`;
    }
    case "new_mutual_connection": {
      return `New mutual connection established with ${change.dimension}`;
    }
    case "following_spike": {
      return `Following count increased from ${change.beforeValue} to ${change.afterValue}, suggesting active engagement`;
    }
    default:
      return "Social connection change detected";
  }
}

// ---------------------------------------------------------------------------
// Notification title generation
// ---------------------------------------------------------------------------

/**
 * Map change types to human-readable notification titles.
 */
function generateSocialNotificationTitle(
  changeType: SocialChangeType,
  dimension: string,
): string {
  switch (changeType) {
    case "follower_spike":
      return "Follower Surge";
    case "follower_drop":
      return "Follower Loss";
    case "notable_follower_gained":
      return `Notable New Follower: ${dimension}`;
    case "notable_follower_lost":
      return `Lost Notable Follower: ${dimension}`;
    case "new_mutual_connection":
      return `New Mutual Connection: ${dimension}`;
    case "following_spike":
      return "Following Surge";
    default:
      return `Social Change: ${dimension}`;
  }
}

// ---------------------------------------------------------------------------
// Notification creation
// ---------------------------------------------------------------------------

/**
 * Create notification records for each detected social change.
 * Returns array of notification IDs.
 */
async function createSocialNotifications(
  accountId: string,
  changes: DetectedSocialChange[],
): Promise<string[]> {
  if (changes.length === 0) return [];

  const rows = await db
    .insert(notification)
    .values(
      changes.map((change) => ({
        accountId,
        detectionRunId: null,
        changeId: null,
        title: generateSocialNotificationTitle(change.type, change.dimension),
        explanation: change.explanation,
        changeType: change.type,
      })),
    )
    .returning({ id: notification.id });

  return rows.map((r) => r.id);
}
