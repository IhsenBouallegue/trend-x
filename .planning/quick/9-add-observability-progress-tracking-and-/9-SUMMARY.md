---
phase: quick-9
plan: 01
subsystem: api, ui
tags: [pipeline, observability, progress-tracking, heartbeat, force-kill, batched-upserts]

# Dependency graph
requires:
  - phase: 14-job-runner
    provides: "Job executor, JobContext, pipeline_run/pipeline_step tables"
  - phase: 16-social-graph
    provides: "Social graph service, social snapshot job, social router"
provides:
  - "Live progress detail text on running pipeline stages"
  - "Heartbeat-based stale detection with 5-minute threshold"
  - "Force-kill mutation for immediately terminating stuck jobs"
  - "Batched DB upserts (~100 per batch) for social connections"
  - "Intra-stage cancellation checks between pagination pages"
  - "Elapsed time display on running stages"
affects: [pipeline-progress, job-runner, social-graph]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batched transaction upserts for large dataset writes"
    - "Heartbeat-based stale detection pattern"
    - "Force-kill (immediate DB update) vs cooperative cancel (cancelledAt)"

key-files:
  modified:
    - "packages/db/src/schema/pipeline-step.ts"
    - "packages/db/src/schema/pipeline-run.ts"
    - "packages/api/src/jobs/types.ts"
    - "packages/api/src/jobs/executor.ts"
    - "packages/api/src/services/social-graph.ts"
    - "packages/api/src/jobs/definitions/social-snapshot-job.ts"
    - "packages/api/src/routers/job.ts"
    - "apps/web/src/components/dashboard/pipeline-stepper.tsx"
    - "apps/web/src/components/dashboard/pipeline-progress.tsx"

key-decisions:
  - "Force-kill marks DB as failed immediately; executor continues until next checkCancellation but frontend sees failed state"
  - "Stale threshold set to 300 seconds (5 minutes) for heartbeat detection"
  - "Batch size of 100 for social connection upserts in transactions"
  - "Progress callbacks optional (onProgress/checkCancellation) to maintain backward compatibility"
  - "Heartbeat updated on setStage, completeStage, and updateProgress"

patterns-established:
  - "updateProgress method on JobContext for intra-stage progress reporting"
  - "isStale boolean computed server-side and included in active runs response"

# Metrics
duration: 7min
completed: 2026-02-11
---

# Quick Task 9: Observability, Progress Tracking, and Force-Kill Summary

**Live progress detail on running pipeline stages with heartbeat-based stale detection, force-kill controls, batched DB upserts, and intra-stage cancellation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-11T03:07:32Z
- **Completed:** 2026-02-11T03:14:32Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Running pipeline stages now show live progress text (e.g., "Fetching following page 3 (450 users so far)")
- Heartbeat timestamp updates on every progress write and stage transition, enabling stale detection
- Force-kill button appears when heartbeat is stale (>5 min), immediately terminates job
- Social connection DB upserts batched in transactions of 100 for performance
- Cancellation checked between pagination pages for intra-stage cooperative cancellation
- Elapsed time counter displayed next to running stage labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema + JobContext + batch upserts + progress callbacks + forceKill** - `67d015c` (feat)
2. **Task 2: Frontend progress detail, elapsed time, stale warning, force-kill button** - `3346774` (feat)

## Files Created/Modified
- `packages/db/src/schema/pipeline-step.ts` - Added progressDetail TEXT column
- `packages/db/src/schema/pipeline-run.ts` - Added lastHeartbeatAt INTEGER column
- `packages/api/src/jobs/types.ts` - Added updateProgress method to JobContext interface
- `packages/api/src/jobs/executor.ts` - Implemented updateProgress, added heartbeat writes to setStage/completeStage
- `packages/api/src/services/social-graph.ts` - Added onProgress/checkCancellation callbacks, batched upserts
- `packages/api/src/jobs/definitions/social-snapshot-job.ts` - Wired progress callbacks to fetchSocialSnapshot
- `packages/api/src/routers/job.ts` - Added forceKill mutation, isStale computation on getActiveRuns/getDetails
- `apps/web/src/components/dashboard/pipeline-stepper.tsx` - ElapsedTime component, progressDetail display, stale warning with force-kill
- `apps/web/src/components/dashboard/pipeline-progress.tsx` - Wired forceKill mutation, isStale/onForceKill props

## Decisions Made
- Force-kill only marks DB state (status=failed) -- executor continues in background until checkCancellation catches it
- Stale threshold of 5 minutes chosen as balance between false positives and detection speed
- Batch size of 100 matches plan spec -- balances transaction overhead vs memory usage
- Progress callbacks are optional parameters to maintain backward compatibility with existing callers
- Heartbeat written on every setStage, completeStage, and updateProgress call

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline observability complete, ready for production use
- All existing pipelines (profile_update, ingest) automatically get heartbeat support via executor changes
- Social snapshot pipeline specifically gets progress detail and intra-stage cancellation

## Self-Check: PASSED

All 9 modified files verified present. Both commit hashes (67d015c, 3346774) verified in git log. All must-have artifacts confirmed: progressDetail column, lastHeartbeatAt column, updateProgress method, forceKill mutation, onProgress callbacks, context.updateProgress wiring, isStale/progressDetail in frontend.

---
*Quick Task: 9*
*Completed: 2026-02-11*
