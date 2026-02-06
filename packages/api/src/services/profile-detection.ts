import { db } from "@trend-x/db";
import { config, notification } from "@trend-x/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { getProvider } from "./ai/provider-factory";
import { trackTokenUsage } from "./ai/token-tracker";
import {
  logProfileActivity,
  type ActivityActionType,
} from "./profile-activity";
import {
  getProfileByAccountId,
  type ActivityMetrics,
  type Personality,
  type PersonalityScores,
  type ProfileTopic,
} from "./profile";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfileChangeType =
  | "personality_drift"
  | "topic_emergence"
  | "topic_abandonment"
  | "activity_anomaly";

export interface DetectedProfileChange {
  type: ProfileChangeType;
  dimension: string;
  explanation: string;
  beforeValue: string | number | null;
  afterValue: string | number;
  metadata: Record<string, unknown>;
}

export interface ProfileDetectionResult {
  accountId: string;
  isBaseline: boolean;
  changes: DetectedProfileChange[];
  notificationIds: string[];
}

interface PreviousMetrics {
  personality?: Personality | null;
  personalityBaseline?: Personality | null;
  topics?: ProfileTopic[];
  activityMetrics?: ActivityMetrics | null;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Detect profile changes for an account by comparing current profile
 * against baselines and previous state.
 *
 * @param accountId - The account to detect changes for
 * @param previousMetrics - Optional previous state for comparison (defaults to baseline from profile)
 * @returns Detection result with changes and notification IDs
 */
export async function detectProfileChanges(
  accountId: string,
  previousMetrics?: PreviousMetrics,
): Promise<ProfileDetectionResult> {
  // Load current profile
  const profile = await getProfileByAccountId(accountId);
  if (!profile) {
    return {
      accountId,
      isBaseline: true,
      changes: [],
      notificationIds: [],
    };
  }

  // If no personality baseline exists, this is a baseline run
  if (!profile.personalityBaseline && !previousMetrics?.personalityBaseline) {
    return {
      accountId,
      isBaseline: true,
      changes: [],
      notificationIds: [],
    };
  }

  // Build comparison state from either explicit previous metrics or profile baselines
  const baseline: PreviousMetrics = previousMetrics ?? {
    personality: profile.personality,
    personalityBaseline: profile.personalityBaseline,
    topics: profile.topics,
    activityMetrics: profile.activityMetrics,
  };

  // 24h repeat suppression: gather recently notified change type+dimension combos
  const suppressedKeys = await getRecentlySuppressedKeys(accountId);

  // Detect changes across all dimensions
  const changes: DetectedProfileChange[] = [];

  // 1. Personality drift detection
  const personalityChanges = detectPersonalityDrift(
    profile.personality,
    baseline.personalityBaseline ?? null,
    suppressedKeys,
  );
  changes.push(...personalityChanges);

  // 2. Topic emergence and abandonment
  const topicChanges = detectTopicChanges(
    profile.topics,
    baseline.topics ?? [],
    suppressedKeys,
  );
  changes.push(...topicChanges);

  // 3. Activity anomalies
  const activityChanges = detectActivityAnomalies(
    profile.activityMetrics,
    baseline.activityMetrics ?? null,
    suppressedKeys,
  );
  changes.push(...activityChanges);

  // If no changes detected, return early
  if (changes.length === 0) {
    return {
      accountId,
      isBaseline: false,
      changes: [],
      notificationIds: [],
    };
  }

  // Generate LLM explanations for all changes in parallel
  const changesWithExplanations = await generateExplanations(changes);

  // Create notification records
  const notificationIds = await createNotifications(
    accountId,
    changesWithExplanations,
  );

  // Log activity
  await logProfileActivity(
    accountId,
    "profile_updated" as ActivityActionType,
    `Detected ${changesWithExplanations.length} profile change(s): ${changesWithExplanations.map((c) => c.type).join(", ")}`,
    {
      changeCount: changesWithExplanations.length,
      changeTypes: changesWithExplanations.map((c) => c.type),
      dimensions: changesWithExplanations.map((c) => c.dimension),
    },
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
 * Matches the pattern from detection.ts but queries the notification table directly.
 */
async function getRecentlySuppressedKeys(
  accountId: string,
): Promise<Set<string>> {
  const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

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
    // Build key from changeType + extracted dimension from title
    // Title format: "Personality Drift: formal" -> dimension = "formal"
    // Title format: "New Topic: AI" -> dimension = "AI"
    // For activity titles: "Activity Spike" -> dimension = "tweets_per_day"
    suppressed.add(`${n.changeType}:${extractDimensionFromTitle(n.title, n.changeType)}`);
  }

  return suppressed;
}

/**
 * Extract dimension from notification title for suppression matching.
 */
function extractDimensionFromTitle(title: string, changeType: string): string {
  // Activity anomaly titles don't have dimensions in them
  if (changeType === "activity_anomaly") {
    // Try to extract from colon-separated format, fall back to generic
    const colonIdx = title.indexOf(": ");
    return colonIdx >= 0 ? title.substring(colonIdx + 2) : "activity";
  }

  // Pattern: "Label: dimension"
  const colonIdx = title.indexOf(": ");
  if (colonIdx >= 0) {
    return title.substring(colonIdx + 2);
  }

  return title;
}

// ---------------------------------------------------------------------------
// Personality drift detection
// ---------------------------------------------------------------------------

/**
 * Detect personality drift by comparing current scores against baseline.
 * Flags any dimension that has shifted >15 points (strict >).
 */
function detectPersonalityDrift(
  current: Personality | null,
  baseline: Personality | null,
  suppressedKeys: Set<string>,
): DetectedProfileChange[] {
  if (!current || !baseline) return [];

  const changes: DetectedProfileChange[] = [];
  const dimensions = Object.keys(current.scores) as Array<
    keyof PersonalityScores
  >;

  for (const dim of dimensions) {
    const suppressKey = `personality_drift:${dim}`;
    if (suppressedKeys.has(suppressKey)) continue;

    const currentVal = current.scores[dim];
    const baselineVal = baseline.scores[dim];
    const drift = Math.abs(currentVal - baselineVal);

    if (drift > 15) {
      const direction = currentVal > baselineVal ? "increased" : "decreased";
      changes.push({
        type: "personality_drift",
        dimension: dim,
        explanation: "", // Filled by LLM
        beforeValue: baselineVal,
        afterValue: currentVal,
        metadata: {
          drift,
          direction,
          baselineScore: baselineVal,
          currentScore: currentVal,
        },
      });
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Topic detection
// ---------------------------------------------------------------------------

/**
 * Detect topic emergence (new topics with >15% share) and
 * topic abandonment (topics that disappeared or dropped below threshold).
 */
function detectTopicChanges(
  currentTopics: ProfileTopic[],
  previousTopics: ProfileTopic[],
  suppressedKeys: Set<string>,
): DetectedProfileChange[] {
  const changes: DetectedProfileChange[] = [];

  // Build maps by topic ID for comparison
  const previousMap = new Map<string, ProfileTopic>();
  for (const topic of previousTopics) {
    previousMap.set(topic.id, topic);
  }

  const currentMap = new Map<string, ProfileTopic>();
  for (const topic of currentTopics) {
    currentMap.set(topic.id, topic);
  }

  // Detect topic emergence: new topics with >15% share (strict >)
  for (const topic of currentTopics) {
    const suppressKey = `topic_emergence:${topic.label}`;
    if (suppressedKeys.has(suppressKey)) continue;

    if (!previousMap.has(topic.id) && topic.proportion > 0.15) {
      changes.push({
        type: "topic_emergence",
        dimension: topic.label,
        explanation: "", // Filled by LLM
        beforeValue: null,
        afterValue: topic.proportion,
        metadata: {
          topicId: topic.id,
          proportion: topic.proportion,
          tweetCount: topic.tweetCount,
          sentiment: topic.sentiment,
        },
      });
    }
  }

  // Detect topic abandonment: previous topics not in current set
  // or dropped to near-zero proportion
  for (const prevTopic of previousTopics) {
    const suppressKey = `topic_abandonment:${prevTopic.label}`;
    if (suppressedKeys.has(suppressKey)) continue;

    const currentTopic = currentMap.get(prevTopic.id);
    if (!currentTopic) {
      // Topic completely gone
      if (prevTopic.proportion > 0.05) {
        // Only flag if it was non-trivial
        changes.push({
          type: "topic_abandonment",
          dimension: prevTopic.label,
          explanation: "", // Filled by LLM
          beforeValue: prevTopic.proportion,
          afterValue: 0,
          metadata: {
            topicId: prevTopic.id,
            previousProportion: prevTopic.proportion,
            previousTweetCount: prevTopic.tweetCount,
          },
        });
      }
    } else {
      // Topic still exists but proportion dropped >50%
      const decreaseRatio =
        (prevTopic.proportion - currentTopic.proportion) /
        prevTopic.proportion;
      if (decreaseRatio > 0.5 && prevTopic.proportion > 0.05) {
        changes.push({
          type: "topic_abandonment",
          dimension: prevTopic.label,
          explanation: "", // Filled by LLM
          beforeValue: prevTopic.proportion,
          afterValue: currentTopic.proportion,
          metadata: {
            topicId: prevTopic.id,
            previousProportion: prevTopic.proportion,
            currentProportion: currentTopic.proportion,
            decreaseRatio,
          },
        });
      }
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Activity anomaly detection
// ---------------------------------------------------------------------------

/**
 * Detect activity anomalies: spikes/drops >2x baseline, unusual silence.
 * Combines activity_spike, activity_drop, and silence into a single
 * "activity_anomaly" change type with descriptive dimensions.
 */
function detectActivityAnomalies(
  current: ActivityMetrics | null,
  previous: ActivityMetrics | null,
  suppressedKeys: Set<string>,
): DetectedProfileChange[] {
  if (!current || !previous) return [];

  const changes: DetectedProfileChange[] = [];

  // Tweets per day anomalies
  if (previous.tweetsPerDay === 0) {
    // Any current activity > 0 is a spike from zero
    if (
      current.tweetsPerDay > 0 &&
      !suppressedKeys.has("activity_anomaly:tweets_per_day_spike")
    ) {
      changes.push({
        type: "activity_anomaly",
        dimension: "tweets_per_day_spike",
        explanation: "",
        beforeValue: 0,
        afterValue: current.tweetsPerDay,
        metadata: { ratio: "infinite", subType: "spike" },
      });
    }
  } else {
    // Activity spike: current > 2x previous (strict >)
    const spikeRatio = current.tweetsPerDay / previous.tweetsPerDay;
    if (
      spikeRatio > 2 &&
      !suppressedKeys.has("activity_anomaly:tweets_per_day_spike")
    ) {
      changes.push({
        type: "activity_anomaly",
        dimension: "tweets_per_day_spike",
        explanation: "",
        beforeValue: previous.tweetsPerDay,
        afterValue: current.tweetsPerDay,
        metadata: { ratio: spikeRatio, subType: "spike" },
      });
    }

    // Activity drop: previous > 2x current (strict >)
    if (current.tweetsPerDay > 0) {
      const dropRatio = previous.tweetsPerDay / current.tweetsPerDay;
      if (
        dropRatio > 2 &&
        !suppressedKeys.has("activity_anomaly:tweets_per_day_drop")
      ) {
        changes.push({
          type: "activity_anomaly",
          dimension: "tweets_per_day_drop",
          explanation: "",
          beforeValue: previous.tweetsPerDay,
          afterValue: current.tweetsPerDay,
          metadata: { ratio: dropRatio, subType: "drop" },
        });
      }
    }
  }

  // Silence detection: current silence > 2x previous (strict >)
  if (
    previous.maxSilenceHours > 0 &&
    current.maxSilenceHours > previous.maxSilenceHours * 2 &&
    !suppressedKeys.has("activity_anomaly:unusual_silence")
  ) {
    changes.push({
      type: "activity_anomaly",
      dimension: "unusual_silence",
      explanation: "",
      beforeValue: previous.maxSilenceHours,
      afterValue: current.maxSilenceHours,
      metadata: {
        ratio: current.maxSilenceHours / previous.maxSilenceHours,
        subType: "silence",
      },
    });
  }

  return changes;
}

// ---------------------------------------------------------------------------
// LLM explanation generation
// ---------------------------------------------------------------------------

/**
 * Generate LLM explanations for all detected profile changes in parallel.
 */
async function generateExplanations(
  changes: DetectedProfileChange[],
): Promise<DetectedProfileChange[]> {
  const results = await Promise.all(
    changes.map(async (change) => {
      try {
        const explanation = await generateChangeExplanation(change);
        return { ...change, explanation };
      } catch (error) {
        console.error(
          "Failed to generate profile change explanation:",
          error,
        );
        return { ...change, explanation: getFallbackExplanation(change) };
      }
    }),
  );

  return results;
}

/**
 * Generate LLM explanation for a single profile change.
 */
async function generateChangeExplanation(
  change: DetectedProfileChange,
): Promise<string> {
  const provider = await getProvider();

  // Read configured chat model
  const [modelRow] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, "ai_chat_model"));
  const model = modelRow?.value || "gpt-4o-mini";

  const response = await provider.chat(model, [
    {
      role: "system",
      content:
        "You are explaining behavioral profile changes for a monitored Twitter account. " +
        "Generate a clear, 1-2 sentence explanation suitable for notifications. " +
        "Be specific about what changed and what it might mean.",
    },
    {
      role: "user",
      content: JSON.stringify({
        type: change.type,
        dimension: change.dimension,
        beforeValue: change.beforeValue,
        afterValue: change.afterValue,
        metadata: change.metadata,
      }),
    },
  ]);

  // Track token usage
  await trackTokenUsage({
    operation: "explanation",
    provider: provider.name,
    model,
    promptTokens: response.promptTokens,
    completionTokens: response.completionTokens,
    totalTokens: response.totalTokens,
  });

  return response.content.trim() || getFallbackExplanation(change);
}

/**
 * Fallback explanations when LLM fails.
 */
function getFallbackExplanation(change: DetectedProfileChange): string {
  switch (change.type) {
    case "personality_drift":
      return `Personality dimension "${change.dimension}" shifted from ${change.beforeValue} to ${change.afterValue} points`;
    case "topic_emergence":
      return `New topic "${change.dimension}" emerged with ${Math.round(Number(change.afterValue) * 100)}% share`;
    case "topic_abandonment":
      return `Topic "${change.dimension}" has been abandoned or significantly reduced`;
    case "activity_anomaly": {
      const subType = (change.metadata?.subType as string) || "change";
      if (subType === "spike")
        return "Tweet frequency increased substantially from baseline";
      if (subType === "drop")
        return "Tweet frequency decreased substantially from baseline";
      if (subType === "silence")
        return "An unusually long gap between tweets was detected";
      return "Activity pattern changed significantly from baseline";
    }
    default:
      return "Profile behavioral change detected";
  }
}

// ---------------------------------------------------------------------------
// Notification creation
// ---------------------------------------------------------------------------

/**
 * Create notification records for each detected profile change.
 * Returns array of notification IDs.
 */
async function createNotifications(
  accountId: string,
  changes: DetectedProfileChange[],
): Promise<string[]> {
  if (changes.length === 0) return [];

  const rows = await db
    .insert(notification)
    .values(
      changes.map((change) => ({
        accountId,
        detectionRunId: null,
        changeId: null,
        title: generateNotificationTitle(change.type, change.dimension),
        explanation: change.explanation,
        changeType: change.type,
      })),
    )
    .returning({ id: notification.id });

  return rows.map((r) => r.id);
}

/**
 * Generate human-readable notification title based on profile change type and dimension.
 */
function generateNotificationTitle(
  changeType: ProfileChangeType,
  dimension: string,
): string {
  const formatted = dimension.replace(/_/g, " ");
  switch (changeType) {
    case "personality_drift":
      return `Personality Drift: ${formatted}`;
    case "topic_emergence":
      return `New Topic: ${formatted}`;
    case "topic_abandonment":
      return `Topic Abandoned: ${formatted}`;
    case "activity_anomaly":
      if (dimension.includes("spike")) return "Activity Spike";
      if (dimension.includes("drop")) return "Activity Drop";
      if (dimension.includes("silence")) return "Unusual Silence";
      return `Activity Anomaly: ${formatted}`;
    default:
      return `Profile Change: ${formatted}`;
  }
}
