/**
 * Social snapshot job definition - fetches social graph and detects signals.
 * Runs the full pipeline: fetch following/followers, diff, detect signals, create notifications.
 */

import { db } from "@trend-x/db";
import { account } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  fetchSocialSnapshot,
  getLatestSnapshot,
} from "../../services/social-graph";
import { detectSocialSignals } from "../../services/social-signals";
import { defineJob } from "../registry";

// --- Stages ---

const socialSnapshotStages = [
  "fetching",
  "processing",
  "detecting",
  "notifying",
  "completing",
] as const;

type SocialSnapshotStage = (typeof socialSnapshotStages)[number];

// --- Input schema ---

const socialSnapshotInputSchema = z.object({
  accountId: z.string(),
});

type SocialSnapshotInput = z.infer<typeof socialSnapshotInputSchema>;

// --- Register job definition ---

defineJob<SocialSnapshotInput, SocialSnapshotStage>({
  type: "social_snapshot",
  stages: socialSnapshotStages,
  inputSchema: socialSnapshotInputSchema,
  maxConcurrent: 1, // Rate limit safety

  executor: async (input, context) => {
    // ===== STAGE 1: FETCHING =====
    await context.setStage("fetching", "Fetching social connections...");

    // Verify account exists
    const [acc] = await db
      .select()
      .from(account)
      .where(eq(account.id, input.accountId));
    if (!acc) {
      throw new Error(`Account not found: ${input.accountId}`);
    }

    // Get previous snapshot for signal detection baseline
    const previousSnapshot = await getLatestSnapshot(input.accountId);

    // Fetch social graph (handles both following and followers)
    const snapshotResult = await fetchSocialSnapshot(
      input.accountId,
      {
        onProgress: (detail) => context.updateProgress("fetching", detail),
        checkCancellation: () => context.checkCancellation(),
      },
    );

    await context.completeStage("fetching", {
      followingCount: snapshotResult.followingCount,
      followerCount: snapshotResult.followerCount,
      mutualCount: snapshotResult.mutualCount,
      type: snapshotResult.type,
    });

    if (await context.checkCancellation()) return;

    // ===== STAGE 2: PROCESSING =====
    await context.setStage("processing", "Processing connection changes...");

    // Prepare diff summary
    const followingAdded = snapshotResult.followingDiff.added.length;
    const followingRemoved = snapshotResult.followingDiff.removed.length;
    const followersAdded = snapshotResult.followersDiff.added.length;
    const followersRemoved = snapshotResult.followersDiff.removed.length;

    await context.completeStage("processing", {
      followingAdded,
      followingRemoved,
      followersAdded,
      followersRemoved,
    });

    if (await context.checkCancellation()) return;

    // ===== STAGE 3: DETECTING =====
    await context.setStage("detecting", "Detecting social signals...");

    // Build previous snapshot for comparison
    const previousCounts = previousSnapshot
      ? {
          followerCount: previousSnapshot.followerCount,
          followingCount: previousSnapshot.followingCount,
        }
      : null;

    let detectionResult: Awaited<ReturnType<typeof detectSocialSignals>> | null =
      null;

    try {
      detectionResult = await detectSocialSignals(
        input.accountId,
        snapshotResult,
        previousCounts,
      );

      if (detectionResult.isBaseline) {
        await context.completeStage("detecting", {
          isBaseline: true,
          changesDetected: 0,
        });

        // Skip notifying stage on baseline
        await context.skipStage("notifying", "Baseline snapshot - no signals to detect");
      } else {
        await context.completeStage("detecting", {
          isBaseline: false,
          changesDetected: detectionResult.changes.length,
        });
      }
    } catch (error) {
      // Detection failure is non-blocking
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Social signal detection failed (non-blocking):", error);
      await context.failStage("detecting", errorMessage);
    }

    if (await context.checkCancellation()) return;

    // ===== STAGE 4: NOTIFYING =====
    const shouldNotify =
      detectionResult &&
      !detectionResult.isBaseline &&
      detectionResult.changes.length > 0;

    if (!shouldNotify && !detectionResult?.isBaseline) {
      // Only skip if we haven't already skipped (baseline case handled above)
      if (detectionResult && !detectionResult.isBaseline) {
        await context.skipStage("notifying", "No social signals detected");
      } else if (!detectionResult) {
        // Detection failed, skip notifying
        await context.skipStage("notifying", "Detection failed - skipping notifications");
      }
    } else if (shouldNotify) {
      await context.setStage("notifying", "Creating notifications...");

      try {
        // Notifications already created by detectSocialSignals
        await context.completeStage("notifying", {
          notificationCount: detectionResult!.notificationIds.length,
        });
      } catch (error) {
        // Notification failure is non-blocking
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Notification stage failed (non-blocking):", error);
        await context.failStage("notifying", errorMessage);
      }
    }

    if (await context.checkCancellation()) return;

    // ===== STAGE 5: COMPLETING =====
    await context.setStage("completing", "Finalizing snapshot...");

    await context.completeStage("completing", {
      snapshotId: snapshotResult.snapshotId,
    });

    // Pipeline complete - executor.ts handles final DB updates
  },
});
