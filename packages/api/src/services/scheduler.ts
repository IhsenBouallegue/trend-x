import { db } from "@trend-x/db";
import { account, scheduledJob } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";
import { CronJob } from "cron";

import { createJobRecord, executeJob } from "../jobs/executor";
import "../jobs/index";

/**
 * Active cron jobs - maps schedule ID to CronJob instance
 */
const activeCronJobs = new Map<string, CronJob>();

/**
 * Fetch tweets for all accounts using job framework.
 * Errors for individual accounts are logged and stored, but don't stop other accounts.
 * Each fetch runs via executeJob (synchronous execution).
 */
async function fetchAllAccounts(): Promise<void> {
  console.log("[Scheduler] Starting scheduled fetch for all accounts...");

  const accounts = await db.select({ id: account.id, handle: account.handle }).from(account);

  if (accounts.length === 0) {
    console.log("[Scheduler] No accounts to fetch");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const acc of accounts) {
    try {
      // Create and execute ingest job
      const jobId = await createJobRecord("ingest", acc.id, { accountId: acc.id });
      await executeJob(jobId);

      console.log(`[Scheduler] Fetched tweets for @${acc.handle}`);
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] Error fetching @${acc.handle}: ${errorMessage}`);

      // Individual account failure doesn't stop other accounts
      errorCount++;
    }
  }

  console.log(`[Scheduler] Fetch complete: ${successCount} success, ${errorCount} errors`);
}

/**
 * Initialize the DB-driven scheduler.
 * Reads all enabled schedules from the database and creates CronJob instances.
 * Seeds default schedule (ingest every 6h) if table is empty.
 */
export async function initializeScheduler(): Promise<void> {
  console.log("[Scheduler] Initializing DB-driven scheduler...");

  // Seed default schedule if table is empty
  const existingSchedules = await db.select().from(scheduledJob);

  if (existingSchedules.length === 0) {
    console.log("[Scheduler] No schedules found, seeding default (ingest every 6h)");
    await db.insert(scheduledJob).values({
      jobType: "ingest",
      cronExpression: "0 */6 * * *",
      enabled: true,
      label: "Tweet Fetch",
    });
  }

  // Load enabled schedules
  await refreshScheduler();
}

/**
 * Refresh the scheduler - stops all active jobs and recreates them from DB.
 * Called after schedule updates to apply new config immediately.
 */
export async function refreshScheduler(): Promise<void> {
  console.log("[Scheduler] Refreshing scheduler from DB...");

  // Stop all existing jobs
  for (const [scheduleId, cronJob] of activeCronJobs.entries()) {
    cronJob.stop();
    console.log(`[Scheduler] Stopped schedule ${scheduleId}`);
  }
  activeCronJobs.clear();

  // Load enabled schedules from DB
  const enabledSchedules = await db
    .select()
    .from(scheduledJob)
    .where(eq(scheduledJob.enabled, true));

  if (enabledSchedules.length === 0) {
    console.log("[Scheduler] No enabled schedules");
    return;
  }

  // Create CronJob for each enabled schedule
  for (const schedule of enabledSchedules) {
    try {
      const cronJob = new CronJob(
        schedule.cronExpression,
        async () => {
          console.log(`[Scheduler] Running scheduled job: ${schedule.label || schedule.jobType}`);

          // Update lastRunAt
          await db
            .update(scheduledJob)
            .set({ lastRunAt: Math.floor(Date.now() / 1000) })
            .where(eq(scheduledJob.id, schedule.id));

          // Execute the job type
          if (schedule.jobType === "ingest") {
            await fetchAllAccounts();
          } else {
            console.warn(`[Scheduler] Unknown job type: ${schedule.jobType}`);
          }
        },
        null, // onComplete
        true, // start immediately
        "UTC",
      );

      activeCronJobs.set(schedule.id, cronJob);
      console.log(
        `[Scheduler] Started: ${schedule.label || schedule.jobType} (${schedule.cronExpression})`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] Failed to create job for ${schedule.id}: ${errorMessage}`);
    }
  }

  console.log(`[Scheduler] Refresh complete: ${activeCronJobs.size} active schedules`);
}

/**
 * Stop the scheduler if running.
 * Stops all active CronJob instances.
 */
export function stopScheduler(): void {
  for (const cronJob of activeCronJobs.values()) {
    cronJob.stop();
  }
  activeCronJobs.clear();
  console.log("[Scheduler] Stopped all schedules");
}
