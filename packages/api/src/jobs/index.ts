/**
 * Job framework barrel export
 *
 * IMPORTANT: Side-effect imports MUST come first to trigger job registration.
 * When any consumer imports from this module, job definitions automatically register.
 */

// Import definitions to trigger registration (side-effect imports)
import "./definitions/ingest-job";
import "./definitions/profile-update-job";
import "./definitions/social-snapshot-job";

// Re-export public API
export { defineJob, getJobDefinition, getAllJobTypes } from "./registry";
export { executeJob, createJobRecord } from "./executor";
export { recoverOrphanedJobs } from "./crash-recovery";
export type { JobDefinition, JobContext, JobStatus, StepStatus } from "./types";
