import { db } from "@trend-x/db";
import { accountProfile } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";

// Type definitions for JSON columns

export interface ProfileTopic {
  id: string;
  label: string;
  centroid: number[]; // Embedding vector
  proportion: number; // 0-1 share of tweets
  tweetCount: number;
  sentiment: { positive: number; neutral: number; negative: number };
}

export interface PersonalityScores {
  formal: number; // 0-100
  technical: number; // 0-100
  provocative: number; // 0-100
  thoughtLeader: number; // 0-100
  commentator: number; // 0-100
  curator: number; // 0-100
  promoter: number; // 0-100
}

export interface Personality {
  scores: PersonalityScores;
  values: string[]; // Free-form extracted values (max 5)
  summary: string; // 1-2 sentence display summary
}

export interface ActivityMetrics {
  tweetsPerDay: number;
  maxSilenceHours: number;
  windowStart: number; // Unix timestamp
  windowEnd: number; // Unix timestamp
}

export interface AccountProfileData {
  id: string;
  accountId: string;
  topics: ProfileTopic[];
  personality: Personality | null;
  activityMetrics: ActivityMetrics | null;
  personalityBaseline: Personality | null;
  totalTweetsProcessed: number;
  lastPersonalityEvalAt: number | null;
  lastUpdatedAt: number;
  createdAt: number;
}

/**
 * Get or create profile for an account.
 * Creates empty profile if none exists.
 */
export async function getOrCreateProfile(
  accountId: string,
): Promise<AccountProfileData> {
  const existing = await db
    .select()
    .from(accountProfile)
    .where(eq(accountProfile.accountId, accountId));

  if (existing.length > 0) {
    return parseProfile(existing[0]!);
  }

  // Create new profile with empty defaults
  // lastUpdatedAt = 0 so first run processes ALL existing tweets
  const [created] = await db
    .insert(accountProfile)
    .values({
      accountId,
      topics: "[]",
      personality: "{}",
      activityMetrics: "{}",
      lastUpdatedAt: 0,
    })
    .returning();

  return parseProfile(created!);
}

/**
 * Get profile by account ID, returns null if not found.
 */
export async function getProfileByAccountId(
  accountId: string,
): Promise<AccountProfileData | null> {
  const [row] = await db
    .select()
    .from(accountProfile)
    .where(eq(accountProfile.accountId, accountId));
  if (!row) return null;
  return parseProfile(row);
}

/**
 * Update profile with partial data. JSON fields are replaced entirely (not merged).
 */
export async function updateProfile(
  accountId: string,
  updates: {
    topics?: ProfileTopic[];
    personality?: Personality;
    activityMetrics?: ActivityMetrics;
    personalityBaseline?: Personality;
    totalTweetsProcessed?: number;
    lastPersonalityEvalAt?: number;
  },
): Promise<AccountProfileData> {
  const now = Math.floor(Date.now() / 1000);

  const dbUpdates: Record<string, unknown> = { lastUpdatedAt: now };

  if (updates.topics !== undefined) {
    dbUpdates.topics = JSON.stringify(updates.topics);
  }
  if (updates.personality !== undefined) {
    dbUpdates.personality = JSON.stringify(updates.personality);
  }
  if (updates.activityMetrics !== undefined) {
    dbUpdates.activityMetrics = JSON.stringify(updates.activityMetrics);
  }
  if (updates.personalityBaseline !== undefined) {
    dbUpdates.personalityBaseline = JSON.stringify(updates.personalityBaseline);
  }
  if (updates.totalTweetsProcessed !== undefined) {
    dbUpdates.totalTweetsProcessed = updates.totalTweetsProcessed;
  }
  if (updates.lastPersonalityEvalAt !== undefined) {
    dbUpdates.lastPersonalityEvalAt = updates.lastPersonalityEvalAt;
  }

  const [updated] = await db
    .update(accountProfile)
    .set(dbUpdates)
    .where(eq(accountProfile.accountId, accountId))
    .returning();

  return parseProfile(updated!);
}

/**
 * Parse raw DB row into typed AccountProfileData.
 * All JSON parsing is handled internally - callers receive typed objects.
 */
function parseProfile(
  row: typeof accountProfile.$inferSelect,
): AccountProfileData {
  const topics = JSON.parse(row.topics) as ProfileTopic[];

  const personality =
    row.personality && row.personality !== "{}"
      ? (JSON.parse(row.personality) as Personality)
      : null;

  const activityMetrics =
    row.activityMetrics && row.activityMetrics !== "{}"
      ? (JSON.parse(row.activityMetrics) as ActivityMetrics)
      : null;

  const personalityBaseline = row.personalityBaseline
    ? (JSON.parse(row.personalityBaseline) as Personality)
    : null;

  return {
    id: row.id,
    accountId: row.accountId,
    topics,
    personality,
    activityMetrics,
    personalityBaseline,
    totalTweetsProcessed: row.totalTweetsProcessed,
    lastPersonalityEvalAt: row.lastPersonalityEvalAt,
    lastUpdatedAt: row.lastUpdatedAt,
    createdAt: row.createdAt,
  };
}
