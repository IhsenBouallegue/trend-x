import { db } from "@trend-x/db";
import { profileActivityLog } from "@trend-x/db/schema";
import { desc, eq } from "drizzle-orm";

export type ActivityActionType =
  | "tweets_classified"
  | "topics_bootstrapped"
  | "profile_updated"
  | "new_topic_detected"
  | "personality_evaluated"
  | "drift_buffer_processed";

export interface ActivityLogEntry {
  id: string;
  accountId: string;
  actionType: ActivityActionType;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

/**
 * Log a profile activity action with human-readable message.
 */
export async function logProfileActivity(
  accountId: string,
  actionType: ActivityActionType,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(profileActivityLog).values({
    accountId,
    actionType,
    message,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

/**
 * Get recent activity for an account.
 * @param limit - Maximum entries to return (default 20)
 */
export async function getRecentActivityByAccount(
  accountId: string,
  limit = 20,
): Promise<ActivityLogEntry[]> {
  const rows = await db
    .select()
    .from(profileActivityLog)
    .where(eq(profileActivityLog.accountId, accountId))
    .orderBy(desc(profileActivityLog.createdAt))
    .limit(limit);

  return rows.map(parseActivityLog);
}

/**
 * Get recent activity across all accounts (global feed).
 * @param limit - Maximum entries to return (default 50)
 */
export async function getRecentActivityGlobal(
  limit = 50,
): Promise<ActivityLogEntry[]> {
  const rows = await db
    .select()
    .from(profileActivityLog)
    .orderBy(desc(profileActivityLog.createdAt))
    .limit(limit);

  return rows.map(parseActivityLog);
}

/**
 * Parse raw DB row into typed ActivityLogEntry.
 */
function parseActivityLog(
  row: typeof profileActivityLog.$inferSelect,
): ActivityLogEntry {
  return {
    id: row.id,
    accountId: row.accountId,
    actionType: row.actionType as ActivityActionType,
    message: row.message,
    metadata: row.metadata
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : null,
    createdAt: row.createdAt,
  };
}
