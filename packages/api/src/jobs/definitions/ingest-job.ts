/**
 * Ingest job definition - migrated from ingest-pipeline.ts
 * Executes tweet fetching, then skips stages 2-6 for UI consistency.
 */

import { z } from "zod";
import { fetchAndStoreTweetsForAccount } from "../../routers/ingest";
import { defineJob } from "../registry";

/**
 * Ingest pipeline stages (same 6 as fingerprint for UI consistency)
 */
const ingestStages = [
  "fetching",
  "embedding",
  "clustering",
  "labeling",
  "detecting",
  "notifying",
] as const;

type IngestStage = typeof ingestStages[number];

/**
 * Ingest job input schema
 */
const ingestInputSchema = z.object({
  accountId: z.string(),
});

type IngestInput = z.infer<typeof ingestInputSchema>;

/**
 * Register ingest job definition
 */
defineJob<IngestInput, IngestStage>({
  type: "ingest",
  stages: ingestStages,
  inputSchema: ingestInputSchema,
  maxConcurrent: 3, // Multiple ingest jobs can run in parallel

  executor: async (input, context) => {
    // ===== STAGE 1: FETCHING (active) =====
    await context.setStage("fetching", "Fetching tweets...");

    // Fetch tweets from Twitter
    const result = await fetchAndStoreTweetsForAccount(input.accountId);
    const tweetCount = result.count;

    await context.completeStage("fetching", { tweetCount });

    // Check cancellation
    if (await context.checkCancellation()) return;

    // ===== STAGES 2-6: SKIP ALL (for UI consistency) =====
    // These stages are skipped for ingest pipelines but must be present for stepper UI

    const skipStages: IngestStage[] = [
      "embedding",
      "clustering",
      "labeling",
      "detecting",
      "notifying",
    ];

    for (const stage of skipStages) {
      await context.skipStage(stage, "Ingest only");

      // Check cancellation between skipped stages
      if (await context.checkCancellation()) return;
    }

    // Pipeline complete - executor.ts handles final DB updates
  },
});
