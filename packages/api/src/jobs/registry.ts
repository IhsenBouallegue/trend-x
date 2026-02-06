/**
 * Job type registry - central Map-based storage for job definitions.
 * Uses registry pattern so adding new job types requires zero framework changes.
 */

import type { JobDefinition } from "./types";

/**
 * Private registry map stores all job definitions.
 * Key: job type string (e.g., "fingerprint", "ingest")
 * Value: JobDefinition cast to unknown for storage
 */
const jobRegistry = new Map<string, JobDefinition<unknown, string>>();

/**
 * Register a job definition in the global registry.
 * Call this at module initialization time for each job type.
 *
 * @example
 * defineJob<{ accountId: string }, "fetching" | "embedding">({
 *   type: "fingerprint",
 *   stages: ["fetching", "embedding"],
 *   executor: async (input, context) => { ... },
 *   inputSchema: z.object({ accountId: z.string() }),
 *   maxConcurrent: 1
 * });
 */
export function defineJob<TInput, TStage extends string>(
  definition: JobDefinition<TInput, TStage>
): void {
  // Cast to unknown for storage - type safety restored at retrieval via inputSchema validation
  jobRegistry.set(definition.type, definition as JobDefinition<unknown, string>);
}

/**
 * Retrieve a job definition from the registry by type.
 * Returns undefined if job type not registered.
 *
 * @param type - Job type identifier (e.g., "fingerprint")
 * @returns Job definition or undefined if not found
 */
export function getJobDefinition(type: string): JobDefinition<unknown, string> | undefined {
  return jobRegistry.get(type);
}

/**
 * Get all registered job type names.
 * Useful for debugging and admin interfaces.
 *
 * @returns Array of registered job type strings
 */
export function getAllJobTypes(): string[] {
  return Array.from(jobRegistry.keys());
}
