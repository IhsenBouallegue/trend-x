---
phase: 16-social-graph-and-social-signals-based-on-followers
plan: 02
subsystem: api
tags: [social-signals, notifications, job-framework, twitter-api, detection]

# Dependency graph
requires:
  - phase: 16-social-graph-and-social-signals-based-on-followers
    plan: 01
    provides: "Social graph schema (social_snapshot, social_connection) and service (fetchSocialSnapshot, getLatestSnapshot)"
  - phase: 14-job-runner
    provides: "Job framework (defineJob, registry, executor, JobContext)"
  - phase: 08-notifications
    provides: "Notification table schema and notification creation patterns"
provides:
  - "Social signal detection service detecting 6 change types"
  - "Template-based explanations for fast signal generation (no LLM)"
  - "24h repeat suppression for social signal notifications"
  - "social_snapshot job type registered in job framework"
  - "5-stage social snapshot job pipeline with non-blocking error handling"
affects: [16-03, 16-04, 16-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Template-based explanations instead of LLM for fast social signal processing"
    - "Notable threshold: blue verified OR >10k followers"
    - "Mutual connection detection cross-referencing following and follower diffs"

key-files:
  created:
    - "packages/api/src/services/social-signals.ts"
    - "packages/api/src/jobs/definitions/social-snapshot-job.ts"
  modified:
    - "packages/api/src/jobs/index.ts"

key-decisions:
  - "Template-based explanations instead of LLM calls for social signals (speed over polish)"
  - "20% threshold for follower spike/drop, 30% threshold for following spike (stricter than profile detection)"
  - "Notable follower definition: isBlueVerified OR followerCount > 10,000"
  - "Mutual connection detection checks both directions (new following who is follower, new follower who is followed)"
  - "maxConcurrent: 1 for social_snapshot jobs (Twitter API rate limit safety)"

patterns-established:
  - "Social signal detection: separate detection functions per change type, aggregated in main function"
  - "Template-based notification explanations for non-LLM signal types"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 16 Plan 02: Social Signal Detection and Snapshot Job Summary

**Social signal detection service with 6 change types (follower spike/drop, notable gains/losses, mutual connections, following surge) and DB-driven social_snapshot job with 5-stage pipeline**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T23:32:28Z
- **Completed:** 2026-02-10T23:35:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Social signal detection service analyzing 6 types of social changes with template-based explanations
- 24h repeat suppression prevents duplicate notifications using same pattern as profile-detection.ts
- Social snapshot job registered as "social_snapshot" in job framework with 5 stages and non-blocking error handling
- Notable follower detection using blue verification status and 10k follower threshold

## Task Commits

Each task was committed atomically:

1. **Task 1: Social signal detection service** - `6615542` (feat)
2. **Task 2: Social snapshot job definition** - `a0baf32` (feat)

## Files Created/Modified
- `packages/api/src/services/social-signals.ts` - Social signal detection: 6 change types, template explanations, 24h suppression, notification creation
- `packages/api/src/jobs/definitions/social-snapshot-job.ts` - Social snapshot job: 5 stages (fetching, processing, detecting, notifying, completing)
- `packages/api/src/jobs/index.ts` - Added side-effect import for social-snapshot-job auto-registration

## Decisions Made
- Template-based explanations instead of LLM calls for social signals: social changes are factual (numbers, usernames) so template strings are sufficient and much faster
- 20% threshold for follower spike/drop (stricter than profile detection because follower counts change more gradually)
- 30% threshold for following spike (mass-following is unusual, warrants lower sensitivity)
- Notable = isBlueVerified OR followerCount > 10,000
- Mutual connection detection: cross-references both following.added against active followers AND followers.added against active following
- Only flags mutual connections if notable OR is a monitored TrendX account

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Social signal detection and job type ready for tRPC router exposure (Plan 16-03)
- Job can be triggered via existing job.trigger tRPC procedure with type "social_snapshot"
- Notification records use existing notification table, visible in existing notification UI

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 16-social-graph-and-social-signals-based-on-followers*
*Completed: 2026-02-11*
