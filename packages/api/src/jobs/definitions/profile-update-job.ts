/**
 * Profile update job definition - incremental profile update pipeline.
 * Replaces fingerprint generation with live profile updates:
 * fetches new tweets, embeds, classifies incrementally, updates activity
 * metrics, evaluates personality (every 50 tweets), and detects changes.
 */

import { db } from "@trend-x/db";
import { account, tweet } from "@trend-x/db/schema";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { getActivityMetrics } from "../../services/activity-metrics";
import { stripUrls } from "../../services/analysis";
import {
  classifyTweetsIncremental,
  type TweetForClassification,
} from "../../services/incremental-classification";
import { generateEmbeddings } from "../../services/openai";
import {
  shouldReEvaluatePersonality,
  evaluatePersonality,
} from "../../services/personality";
import { detectProfileChanges } from "../../services/profile-detection";
import {
  getOrCreateProfile,
  updateProfile,
  type ActivityMetrics,
} from "../../services/profile";
import { logProfileActivity } from "../../services/profile-activity";
import { fetchAndStoreTweetsForAccount } from "../../routers/ingest";
import { defineJob } from "../registry";

// --- Stages ---

const profileUpdateStages = [
  "fetching",
  "embedding",
  "classifying",
  "updating",
  "detecting",
  "notifying",
] as const;

type ProfileUpdateStage = (typeof profileUpdateStages)[number];

// --- Input schema ---

const profileUpdateInputSchema = z.object({
  accountId: z.string(),
});

type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;

// --- Helper: extract quoted text from rawJson ---

function extractQuotedText(rawJson: string | null): string | null {
  if (!rawJson) return null;
  try {
    const json = JSON.parse(rawJson) as Record<string, unknown>;
    // Bird CLI format: quoted_status object with text field
    const quotedStatus = json.quoted_status as
      | Record<string, unknown>
      | undefined;
    if (quotedStatus?.text) {
      return quotedStatus.text as string;
    }
    // Alternative format: quotedTweet
    const quotedTweet = json.quotedTweet as
      | Record<string, unknown>
      | undefined;
    if (quotedTweet?.text) {
      return quotedTweet.text as string;
    }
    return null;
  } catch {
    return null;
  }
}

// --- Register job definition ---

defineJob<ProfileUpdateInput, ProfileUpdateStage>({
  type: "profile_update",
  stages: profileUpdateStages,
  inputSchema: profileUpdateInputSchema,
  maxConcurrent: 1,

  executor: async (input, context) => {
    // Track data across stages
    let newTweets: Array<{
      id: string;
      text: string;
      tweetCreatedAt: number;
      isQuoteTweet: number;
      rawJson: string | null;
    }> = [];
    let tweetsForClassification: TweetForClassification[] = [];
    let previousActivityMetrics: ActivityMetrics | null = null;

    // ===== STAGE 1: FETCHING =====
    await context.setStage("fetching", "Fetching new tweets...");

    // Verify account exists
    const [acc] = await db
      .select()
      .from(account)
      .where(eq(account.id, input.accountId));
    if (!acc) {
      throw new Error(`Account not found: ${input.accountId}`);
    }

    // Get current profile to know what was already processed
    const profile = await getOrCreateProfile(input.accountId);

    // Snapshot previous activity metrics for change detection later
    previousActivityMetrics = profile.activityMetrics;

    // Fetch fresh tweets from Twitter
    await fetchAndStoreTweetsForAccount(input.accountId);

    // Get tweets newer than the profile's lastUpdatedAt timestamp
    // This gives us only tweets that haven't been processed yet
    const lastUpdateTime = profile.lastUpdatedAt;

    newTweets = await db
      .select({
        id: tweet.id,
        text: tweet.text,
        tweetCreatedAt: tweet.tweetCreatedAt,
        isQuoteTweet: tweet.isQuoteTweet,
        rawJson: tweet.rawJson,
      })
      .from(tweet)
      .where(
        and(
          eq(tweet.accountId, input.accountId),
          gt(tweet.tweetCreatedAt, lastUpdateTime),
        ),
      )
      .orderBy(desc(tweet.tweetCreatedAt));

    if (newTweets.length === 0) {
      // No new tweets - skip remaining stages
      await context.completeStage("fetching", { tweetCount: 0 });

      await context.skipStage("embedding", "No new tweets");
      await context.skipStage("classifying", "No new tweets");
      await context.skipStage("updating", "No new tweets");
      await context.skipStage("detecting", "No new tweets");
      await context.skipStage("notifying", "No new tweets");
      return;
    }

    await context.completeStage("fetching", { tweetCount: newTweets.length });

    if (await context.checkCancellation()) return;

    // ===== STAGE 2: EMBEDDING =====
    await context.setStage("embedding", "Generating embeddings...");

    // Enrich quote tweets with quoted content BEFORE embedding
    const tweetsWithEnrichedText = newTweets.map((t) => {
      const quotedText =
        t.isQuoteTweet === 1 ? extractQuotedText(t.rawJson) : null;
      const baseText = stripUrls(t.text);

      // For quote tweets, append quoted content for richer semantic signal
      const enrichedText =
        quotedText && t.isQuoteTweet === 1
          ? `${baseText}\n[Quoting: "${stripUrls(quotedText)}"]`
          : baseText;

      return {
        ...t,
        strippedText: baseText,
        enrichedText: enrichedText.length > 0 ? enrichedText : baseText,
      };
    });

    // Filter out tweets with no text content after stripping
    const tweetsWithContent = tweetsWithEnrichedText.filter(
      (t) => t.enrichedText.length > 0,
    );

    if (tweetsWithContent.length === 0) {
      await context.completeStage("embedding", { embeddingCount: 0 });
      await context.skipStage("classifying", "No tweets with text content");
      await context.skipStage("updating", "No tweets with text content");
      await context.skipStage("detecting", "No tweets with text content");
      await context.skipStage("notifying", "No tweets with text content");
      return;
    }

    // Generate embeddings using the enriched text
    const embeddingResults = await generateEmbeddings(
      tweetsWithContent.map((t) => t.enrichedText),
    );

    // Build classification input
    tweetsForClassification = tweetsWithContent.map((t, i) => ({
      id: t.id,
      text: t.strippedText,
      embedding: embeddingResults[i]!.embedding,
      tweetCreatedAt: t.tweetCreatedAt,
      enrichedText: t.enrichedText,
    }));

    await context.completeStage("embedding", {
      embeddingCount: embeddingResults.length,
    });

    if (await context.checkCancellation()) return;

    // ===== STAGE 3: CLASSIFYING =====
    await context.setStage("classifying", "Classifying tweets...");

    const classificationResult = await classifyTweetsIncremental(
      input.accountId,
      tweetsForClassification,
    );

    await context.completeStage("classifying", {
      matched: classificationResult.matched.length,
      drifted: classificationResult.drifted.length,
      newTopics: classificationResult.newTopicsCreated,
    });

    if (await context.checkCancellation()) return;

    // ===== STAGE 4: UPDATING =====
    await context.setStage("updating", "Updating profile metrics...");

    // Compute fresh activity metrics
    const activityMetrics = await getActivityMetrics(input.accountId);

    // Update profile with new activity metrics
    await updateProfile(input.accountId, {
      activityMetrics: {
        tweetsPerDay: activityMetrics.tweetsPerDay,
        maxSilenceHours: activityMetrics.maxSilenceHours,
        windowStart: activityMetrics.windowStart,
        windowEnd: activityMetrics.windowEnd,
      },
    });

    // Check if personality should be re-evaluated (every 50 tweets)
    const updatedProfile = await getOrCreateProfile(input.accountId);
    let personalityEvaluated = false;

    if (
      shouldReEvaluatePersonality(
        updatedProfile.totalTweetsProcessed,
        updatedProfile.lastPersonalityEvalAt,
      )
    ) {
      try {
        await evaluatePersonality(input.accountId);
        personalityEvaluated = true;
      } catch (error) {
        // Personality evaluation failure is non-blocking
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "Personality evaluation failed (non-blocking):",
          errorMessage,
        );
      }
    }

    await context.completeStage("updating", {
      tweetsPerDay: activityMetrics.tweetsPerDay,
      personalityEvaluated,
    });

    if (await context.checkCancellation()) return;

    // ===== STAGE 5: DETECTING =====
    await context.setStage("detecting", "Detecting changes...");

    let detectionResult: Awaited<ReturnType<typeof detectProfileChanges>> | null =
      null;

    try {
      // Pass previous metrics for comparison
      detectionResult = await detectProfileChanges(input.accountId, {
        activityMetrics: previousActivityMetrics,
      });

      await context.completeStage("detecting", {
        isBaseline: detectionResult.isBaseline,
        changesDetected: detectionResult.changes.length,
      });
    } catch (error) {
      // Detection failure is non-blocking
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Profile change detection failed (non-blocking):", error);
      await context.failStage("detecting", errorMessage);
    }

    if (await context.checkCancellation()) return;

    // ===== STAGE 6: NOTIFYING =====
    const shouldNotify =
      detectionResult &&
      !detectionResult.isBaseline &&
      detectionResult.changes.length > 0;

    if (!shouldNotify) {
      await context.skipStage("notifying", "No changes to notify");
    } else {
      await context.setStage("notifying", "Sending notifications...");

      try {
        // Profile detection already created notification records;
        // send Telegram for any new notifications
        if (detectionResult!.notificationIds.length > 0) {
          // Profile detection already created notification records in-DB.
          // Log the notification event for activity tracking.
          await logProfileActivity(
            input.accountId,
            "profile_updated",
            `Profile update complete. ${detectionResult!.changes.length} change(s) detected and notified.`,
            {
              changeTypes: detectionResult!.changes.map((c) => c.type),
              notificationIds: detectionResult!.notificationIds,
            },
          );
        }

        await context.completeStage("notifying", {
          notificationCount: detectionResult!.notificationIds.length,
        });
      } catch (error) {
        // Notification failure is non-blocking
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Notification failed (non-blocking):", error);
        await context.failStage("notifying", errorMessage);
      }
    }

    // Pipeline complete - executor.ts handles final DB updates
  },
});
