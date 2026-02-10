---
phase: 16-social-graph-and-social-signals-based-on-followers
plan: 03
subsystem: api, ui
tags: [trpc, react-query, social-graph, drizzle]

# Dependency graph
requires:
  - phase: 16-social-graph-and-social-signals-based-on-followers
    plan: 01
    provides: "social_snapshot and social_connection schema tables, social graph service"
provides:
  - "Social tRPC router with 6 query procedures (snapshots, charts, connections, changes, graph, stats)"
  - "React Query hooks for all social data endpoints"
  - "Query key factory for social data with double-nested tRPC format"
affects: [16-04, 16-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Social router procedures query schema tables directly (no service layer indirection for reads)"
    - "Force-directed graph data built from cross-referencing monitored accounts with shared connections"
    - "Notable connection filtering (blue verified OR >10k followers)"

key-files:
  created:
    - "packages/api/src/routers/social.ts"
    - "apps/web/src/hooks/queries/use-social-queries.ts"
  modified:
    - "packages/api/src/routers/index.ts"
    - "apps/web/src/hooks/queries/query-keys.ts"
    - "apps/web/src/hooks/queries/index.ts"

key-decisions:
  - "Social router queries DB directly rather than delegating to service layer (read-only queries are simple enough)"
  - "Graph data identifies cross-monitored-account links by matching connection usernames to monitored account handles"
  - "Notable connections in graph visualization: blue verified OR >10k followers"
  - "Stale times: 60s for slow-changing data (charts, graph), 30s for moderate (snapshots, connections, stats)"

patterns-established:
  - "Social query hooks follow same pattern as profile hooks (enabled guard, staleTime, queryOptions spread)"
  - "Graph node sizing: val=10 for monitored accounts, val=3 for notable connections"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 16 Plan 03: Social tRPC Router and React Query Hooks Summary

**tRPC router with 6 social graph query procedures and 7 React Query hooks providing typed frontend access to snapshots, charts, connections, changes, graph visualization, and stats**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T23:32:29Z
- **Completed:** 2026-02-10T23:35:15Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Social tRPC router with 6 procedures: getSnapshotHistory, getFollowerChart, getConnections, getRecentChanges, getGraphData, getStats
- Force-directed graph data builder that cross-references monitored accounts and identifies shared notable connections
- 7 React Query hooks with appropriate stale times and enable guards for all social data endpoints
- Query key factory for social data following established double-nested tRPC convention

## Task Commits

Each task was committed atomically:

1. **Task 1: Social tRPC router** - `918eb33` (feat)
2. **Task 2: React Query hooks and query keys** - `e32b7ae` (feat)

## Files Created/Modified
- `packages/api/src/routers/social.ts` - tRPC router with 6 query procedures for social graph data
- `packages/api/src/routers/index.ts` - Register socialRouter in appRouter (alphabetical order)
- `apps/web/src/hooks/queries/use-social-queries.ts` - 7 React Query hooks for social data
- `apps/web/src/hooks/queries/query-keys.ts` - Social key factory added to queryKeys object
- `apps/web/src/hooks/queries/index.ts` - Barrel export for use-social-queries

## Decisions Made
- Social router queries DB tables directly rather than delegating to a service layer -- read-only queries are straightforward enough that an additional abstraction layer would add complexity without benefit
- Graph data builder identifies cross-monitored-account links by matching connection usernames (lowercased) to monitored account handles
- Notable connections for graph visualization defined as blue verified OR >10k followers
- Stale times set to 60s for slow-changing data (charts, graph) and 30s for moderate-change data (snapshots, connections, stats)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full API layer for social graph data is operational
- Frontend can query snapshot history, follower charts, connection lists, recent changes, graph data, and stats via typed React Query hooks
- Ready for Plan 16-04 (UI components) to consume these hooks in dashboard components

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 16-social-graph-and-social-signals-based-on-followers*
*Completed: 2026-02-11*
