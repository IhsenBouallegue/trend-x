/**
 * Crash recovery - startup cleanup for orphaned running/queued jobs.
 * Marks jobs that were running when server crashed as failed.
 */

import { db } from "@trend-x/db";
import { pipelineRun, pipelineStep } from "@trend-x/db/schema";
import { eq, inArray, or } from "drizzle-orm";

/**
 * Recover orphaned jobs on server startup.
 * Finds all jobs with status "running" or "queued" and marks them as failed.
 * This prevents stuck jobs from appearing to be in progress when they're not.
 *
 * Call this function on server startup before accepting requests.
 *
 * @returns Number of orphaned jobs found and marked as failed
 */
export async function recoverOrphanedJobs(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  // 1. Find all orphaned jobs (running or queued when server crashed)
  const orphanedJobs = await db
    .select()
    .from(pipelineRun)
    .where(or(eq(pipelineRun.status, "running"), eq(pipelineRun.status, "queued")));

  if (orphanedJobs.length === 0) {
    return 0;
  }

  console.log(`[CrashRecovery] Found ${orphanedJobs.length} orphaned jobs, marking as failed`);

  const orphanedJobIds = orphanedJobs.map((job) => job.id);

  // 2. Mark all orphaned jobs as failed
  await db
    .update(pipelineRun)
    .set({
      status: "failed",
      errorMessage: "Server restarted during execution",
      completedAt: now,
    })
    .where(inArray(pipelineRun.id, orphanedJobIds));

  // 3. Mark all running steps as failed
  await db
    .update(pipelineStep)
    .set({
      status: "failed",
      errorMessage: "Server restarted during execution",
      completedAt: now,
    })
    .where(eq(pipelineStep.status, "running"));

  console.log(`[CrashRecovery] Successfully recovered ${orphanedJobs.length} orphaned jobs`);

  return orphanedJobs.length;
}
