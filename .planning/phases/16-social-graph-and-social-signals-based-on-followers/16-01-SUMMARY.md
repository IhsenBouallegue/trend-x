---
phase: 16-social-graph-and-social-signals-based-on-followers
plan: 01
subsystem: database, api
tags: [drizzle, sqlite, twitter-api, social-graph, bird]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Drizzle ORM, libSQL database, account table"
provides:
  - "social_snapshot table for per-account fetch metadata"
  - "social_connection table for individual follower/following records"
  - "Social graph service with fetch, store, and diff functions"
  - "Paginated Twitter API fetching with smart early-stop optimization"
affects: [16-02, 16-03, 16-04, 16-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Active/inactive connection tracking with composite unique index upsert"
    - "Smart early-stop optimization (3 consecutive known pages threshold)"
    - "Bidirectional connection tracking (following/follower/mutual)"

key-files:
  created:
    - "packages/db/src/schema/social-snapshot.ts"
    - "packages/db/src/schema/social-connection.ts"
    - "packages/api/src/services/social-graph.ts"
  modified:
    - "packages/db/src/schema/index.ts"

key-decisions:
  - "Composite unique index on (accountId, userId, direction) for upsert pattern"
  - "Individual update loops for removed connections instead of batch inArray (simpler for SQLite)"
  - "Early-stop carries over previous IDs to avoid false removal detection on partial fetches"
  - "Mutual connections stored as direction='mutual' (single row, not dual following+follower)"

patterns-established:
  - "Social connection upsert: onConflictDoUpdate with composite unique index target array"
  - "Connection diff: Set-based comparison of current vs previous user IDs"

# Metrics
duration: 8min
completed: 2026-02-11
---

# Phase 16 Plan 01: Social Graph Schema and Core Service Summary

**Drizzle schema for social graph tracking (snapshots + connections) with paginated Twitter API fetch, smart early-stop, and set-based diff logic**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-10T23:21:50Z
- **Completed:** 2026-02-10T23:29:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Two new schema tables (social_snapshot, social_connection) with composite unique index for duplicate prevention
- Full social graph service ported from debug-fetch-tweets.ts prototype into the service layer
- Smart early-stop optimization prevents unnecessary API calls on repeat fetches (3 consecutive known pages threshold)
- Active/inactive connection tracking with direction-aware upsert (following/follower/mutual)

## Task Commits

Each task was committed atomically:

1. **Task 1: Social graph database schema** - `a4c4f85` (feat)
2. **Task 2: Social graph service with fetch, store, and diff** - `e3224c5` (feat)

## Files Created/Modified
- `packages/db/src/schema/social-snapshot.ts` - Metadata per social graph fetch run (counts, diffs, type)
- `packages/db/src/schema/social-connection.ts` - Individual follower/following records with active/inactive tracking
- `packages/db/src/schema/index.ts` - Barrel export updated with new schema files
- `packages/api/src/services/social-graph.ts` - Core service: fetch, store, diff, query helpers

## Decisions Made
- Composite unique index on (accountId, userId, direction) enables clean upsert pattern for connection updates
- Individual update loops for removed connections instead of batch inArray (simpler for SQLite, avoids parameter limit concerns)
- Early-stop carries over previous user IDs to the current set so partial fetches don't trigger false removal detection
- Mutual connections stored as direction="mutual" in a single row rather than maintaining separate following+follower rows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema is live (db:push succeeded), service compiles and exports all required functions
- Ready for Plan 16-02 (tRPC router) to expose social graph via API endpoints
- Ready for Plan 16-03 (job integration) to schedule periodic social graph fetches

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 16-social-graph-and-social-signals-based-on-followers*
*Completed: 2026-02-11*
