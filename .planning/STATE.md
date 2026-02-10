# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** Detect and notify when a monitored Twitter account's behavior meaningfully changes, so you can keep up with significant news before it's obvious.
**Current focus:** Social Graph and Social Signals (Phase 16: follower/following tracking and social signals)

## Current Position

Phase: 16 of 16 (Social Graph and Social Signals)
Plan: 4 of 5
Status: Completed 16-03-PLAN.md
Last activity: 2026-02-11 — Completed 16-03-PLAN.md (social tRPC router + React Query hooks)

Progress: Phase 16 [######----] 60% (3/5 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 14 (v1.0)
- Average duration: 8.2 min
- Total execution time: 115 min (v1.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 48 min | 24 min |
| 02-ingestion | 2 | 20 min | 10 min |
| 03-analysis | 2 | 5 min | 2.5 min |
| 04-dashboard | 2 | 13 min | 6.5 min |
| 05-improved-fingerprinting | 5 | 25 min | 5 min |
| 06-server-api-consolidation | 1 | 4 min | 4 min |

**v2.0 Progress:**
- Phases: 3/6 complete (7, 9, 11)
- Plans: 8/TBD complete

**Phase 7 Performance:**
- Plans: 2 complete
- Duration: 6 min (4 min + 2 min)
- Average: 3 min/plan

**Phase 8 Performance:**
- Plans: 3 complete
- Duration: 13 min (5 min + 4 min + 4 min)
- Average: 4.3 min/plan

**Phase 9 Performance:**
- Plans: 2 complete
- Duration: 11 min (3 min + 8 min)
- Average: 5.5 min/plan

**Phase 10 Performance:**
- Plans: 3 complete
- Duration: 22 min (6 min + 7 min + 9 min)
- Average: 7.3 min/plan

**Phase 11 Performance:**
- Plans: 1 complete
- Duration: 6 min
- Average: 6 min/plan

**Phase 12 Performance:**
- Plans: 1 complete
- Duration: 3 min
- Average: 3 min/plan

**Phase 13 Performance:**
- Plans: 4 complete
- Duration: 13.5 min (3 min + 7 min + 3.5 min)
- Average: 4.5 min/plan

**Phase 14 Performance:**
- Plans: 5 complete
- Duration: 23 min (3 min + 2 min + 5 min + 7 min + 6 min)
- Average: 4.6 min/plan

**Phase 15 Performance:**
- Plans: 13 complete
- Duration: 64 min (3 min + 3 min + 3 min + 3 min + 3.5 min + 6 min + 2 min + 3 min + 4.5 min + 14 min + 2 min + 15 min + 2 min)
- Average: 4.9 min/plan

**Phase 16 Performance:**
- Plans: 2 complete
- Duration: 11 min (8 min + 3 min)
- Average: 5.5 min/plan

## Accumulated Context

### Decisions

Recent decisions from PROJECT.md affecting v2.0 work:

- v1.0: Validation-first approach (fingerprinting before alerting) - Foundation ready
- v1.0: libSQL + Drizzle ORM - Will extend with alert tables
- v1.0: OpenAI (text-embedding-3-small + gpt-4o-mini) - Will reuse for alert explanations
- v1.0: @steipete/bird library integration - Tweet data pipeline established

**Phase 7 Decisions:**
- 07-01: Registry-based topic comparison using fingerprintTopicMapping with topicRegistryId instead of label matching
- 07-01: Weighted sentiment computed as sum(proportion × sentimentValue) across all topics for overall sentiment
- 07-01: Simple repeat suppression using 24h time-based with type+dimension combination as key
- 07-01: Explanation timing: Generate at detection time, store in DB for reuse in dashboard and notifications
- 07-01: Strict thresholds: All comparisons use strict > (not >=)
- 07-02: Detection wrapped in try-catch to ensure failures never block fingerprint generation
- 07-02: Detection result included in fingerprint response for immediate dashboard feedback
- 07-02: detectNow requires existing fingerprint, throws error if none available

**Phase 8 Decisions:**
- 08-01: Notification creation happens synchronously in detection pipeline (if notification insert fails, detection fails)
- 08-01: Each detected change generates exactly one notification with title and explanation
- 08-01: Read state tracked with boolean flag and timestamp for analytics
- 08-02: Used shadcn CLI with base-lyra style for consistent component patterns
- 08-02: react-tweet v3.3.0 for iframe-free tweet rendering
- 08-03: Optimistic updates for mark-as-read mutations with onMutate/onError/onSettled
- 08-03: Controlled accordion state to prevent collapse on refetch
- 08-03: Evidence tweets limited to 3 max for performance
- 08-03: Twitter status IDs passed directly to react-tweet (no UUID mapping needed)

**Phase 9 Decisions:**
- 09-01: Exponential backoff with 3 retries, 1s-60s delay, full jitter for transient failures
- 09-01: Retry on 429/5xx, fail fast on 400/401/403
- 09-01: HTML escape all user content to prevent Telegram parse errors
- 09-01: Silent skip when not configured/enabled (opt-in model)
- 09-02: Auto-fetch chat ID via getUpdates instead of manual entry
- 09-02: Non-blocking Telegram delivery in fingerprint pipeline (try-catch)

**Phase 10 Decisions:**
- 10-01: Unified AIProvider interface for all providers (OpenAI, OpenRouter, Ollama)
- 10-01: OpenRouter uses OpenAI SDK with custom baseURL (drop-in compatibility)
- 10-01: Ollama uses native fetch due to different API format
- 10-01: Token usage tracked per operation (embedding, labeling, sentiment, explanation)
- 10-01: Provider instances cached based on active provider name
- 10-01: Model categorization uses provider metadata first, then name-based heuristics
- 10-02: AI config router exposes 5 procedures (getConfig, setConfig, listModels, getUsageStats, detectOllama)
- 10-02: Dynamic credential validation - isConfigured checks based on active provider (openai_api_key for OpenAI, openrouter_api_key for OpenRouter, none for Ollama)
- 10-02: Token tracking synchronous for all AI operations (~10ms overhead per call)
- 10-02: Backward compatible exports (resetOpenAIClient delegates to resetProviderCache, getProvider re-exported)
- 10-02: listModels creates temp provider to preview models without affecting cached config
- 10-03: Provider state typed as union literal ("openai" | "openrouter" | "ollama") for type safety
- 10-03: Model selector enabled only when provider selected AND credentials available
- 10-03: Usage chart uses date-fns for date formatting (MMM d format) with stacked bars
- 10-03: Settings page order: Twitter credentials, AI config, Telegram notifications
- 10-03: Removed old OpenAI-only card (migrated to AIConfigSection)

**Phase 11 Decisions:**
- 11-01: Static Server Component (no "use client") for documentation pages for better SEO
- 11-01: BaseUI Accordion without openMultiple prop (default behavior allows multi-section expansion)
- 11-01: 6 sections covering full pipeline: overview, data collection, analysis, detection, notifications, visualizations

**Phase 12 Decisions:**
- 12-01: getMetrics uses separate count queries for accounts and notifications (simple and efficient for small datasets)
- 12-01: getNotificationTrend groups by date in JavaScript to avoid SQLite date function complexity with unix timestamps
- 12-01: Zero-fill missing dates in getNotificationTrend for continuous chart rendering (no gaps)
- 12-01: getRecentActivity limits to 20 most recent for performance

**Phase 13 Decisions:**
- 13-01: Stage-level granularity (~6 stages) for pipeline progress tracking
- 13-01: Discriminated union types for compile-time state transition safety
- 13-01: Global machine registry indexed by runId for SSE endpoint lookups
- 13-01: In-memory FIFO queue ensuring one pipeline at a time globally
- 13-01: StepRecord array tracks all stages (pending/running/completed/skipped/failed)
- 13-02: Fingerprint pipeline has 6 stages: fetching, embedding, clustering, labeling, detecting, notifying
- 13-02: Ingest pipeline uses same 6-stage structure but only executes fetching, skips 2-6 for UI consistency
- 13-02: tRPC generate mutation awaits pipeline completion (synchronous response) while machine enables parallel SSE
- 13-02: Detection failure non-blocking - records error but continues pipeline
- 13-02: Notification failure non-blocking - records error but completes pipeline
- 13-02: Baseline fingerprints skip detection stage, recorded as skipped in DB
- 13-02: No changes skip notification stage, recorded as skipped in DB
- 13-02: Drizzle ORM requires and() for compound where clauses (not chained .where())
- 13-02: State machine step updates must explicitly set all fields (spread operator breaks type safety)
- 13-04: Native EventSource API used instead of third-party SSE library
- 13-04: PipelineState/StepRecord types mirrored on client for type safety without shared package
- 13-04: Auto-collapse after 5 seconds on completion, 8-second activeRunId clear
- 13-04: Failed pipelines do not auto-collapse (user needs to see error)
- 13-04: Query invalidation on completion refreshes dashboard immediately
- 13-04: Fire-and-forget mutation pattern for async pipeline execution

**Phase 14 Decisions:**
- 14-01: Reuse existing pipeline_run/pipeline_step tables (not new job/job_step tables)
- 14-01: Backward compatible with existing rows via accountId fallback when input is null
- 14-01: Registry stores JobDefinition<unknown, string> with type safety via Zod validation
- 14-01: Crash recovery marks both running AND queued jobs as failed on startup
- 14-01: durationMs computed as (completedAt - startedAt) * 1000
- 14-01: Cooperative cancellation via cancelledAt DB column (no AbortController propagation)
- 14-01: createJobRecord checks per-type concurrency limits before inserting
- 14-02: Fingerprint job executor replicates exact service call sequence from fingerprint-pipeline.ts
- 14-02: Detection and notification failures are non-blocking (failStage without throw)
- 14-02: Cancellation checks between every stage via context.checkCancellation()
- 14-02: Fingerprint maxConcurrent 1, ingest maxConcurrent 3 (parallel ingests allowed)
- 14-02: Side-effect imports in barrel index trigger job registration automatically
- 14-03: Job router uses fire-and-forget pattern (trigger mutation with void executeJob())
- 14-03: getCurrentRun checks both queued and running status (jobs start as queued)
- 14-03: fingerprint.generate synchronous for backward compatibility (awaits completion)
- 14-03: Server uses top-level await for crash recovery (Bun supports module-level await)
- 14-03: SSE endpoint removed - polling via tRPC replaces push-based SSE
- 14-03: Added input column to pipeline_run schema (bug fix - executor referenced but didn't exist)
- 14-04: URL state (?jobId) instead of React context for active job persistence
- 14-04: Polling stops automatically when job status becomes terminal (completed/failed/cancelled)
- 14-04: Auto-clear jobId from URL 8s after completion (5s collapse + 3s buffer)
- 14-04: PipelineState/StepRecord types moved to pipeline-stepper.tsx (breaks dependency on old hook)
- 14-04: mapJobToPipelineState/mapJobStepsToStepRecords transform DB data to UI format
- 14-04: Run history switched to job.getHistory from pipeline.getRunHistory
- 14-06: Scheduler reads cron config from DB instead of hardcoded values
- 14-06: refreshScheduler() stops and recreates CronJobs for live config updates without restart
- 14-06: Default seed: ingest job every 6h created if scheduled_job table is empty
- 14-06: Preset frequencies (hourly, 2h, 4h, 6h, 12h, 24h) plus custom input for advanced users
- 14-06: Schedule section in settings page between AI Config and Telegram sections

**Phase 15 Decisions:**
- 15-01: Denormalized JSON columns for topics, personality, activity_metrics instead of normalized tables
- 15-01: Personality baseline stored separately for drift detection comparison
- 15-01: Unique constraint on accountId (one profile per account)
- 15-02: AccountProfileData interface (not AccountProfile) to avoid collision with Drizzle schema export
- 15-02: JSON fields replaced entirely on update (not merged) for simplicity and predictability
- 15-02: Internal parseProfile/parseActivityLog handle all JSON deserialization - callers always get typed objects
- 15-03: Weighted centroid update uses 1/(n+1) where n = current tweetCount
- 15-03: Drift buffer stores embedding as JSON string, fetches tweet text on re-cluster
- 15-03: Proportions recalculated from tweetCount after each classification batch
- 15-04: JSON-mode prompting with Zod validation instead of native structured outputs (AIProvider.chat lacks responseFormat)
- 15-04: Weighted recency sampling: all tweets eligible, recent weighted more via temporal decay
- 15-04: N=50 tweet threshold for personality re-evaluation using modulo check
- 15-04: Quote tweet enrichment: parse rawJson for quoted_status.text or quotedTweet.text
- 15-04: Personality baseline set on first evaluation only
- 15-04: Max 200 tweets fetched, 60 sampled for prompt to stay within token limits
- 15-05: Personality drift threshold strict >15 points from baseline
- 15-05: Topic emergence >15% share, abandonment >50% drop or disappearance (>5% minimum previous)
- 15-05: Activity anomalies: spikes/drops >2x baseline, silence >2x previous max
- 15-05: Notification schema: detectionRunId and changeId made nullable for profile-based detection
- 15-05: Repeat suppression queries notification table directly (changeType+dimension within 24h)
- 15-05: Profile change types: personality_drift, topic_emergence, topic_abandonment, activity_anomaly
- 15-06: Profile update job replaces fingerprint job in generate mutation (profile_update job type)
- 15-06: 6 stages: fetching, embedding, classifying, updating, detecting, notifying
- 15-06: Quote tweet enrichment before embedding (quoted content appended to text)
- 15-06: Personality evaluated conditionally within updating stage (non-blocking on failure)
- 15-06: Profile-based notifications created in DB by detectProfileChanges (no Telegram send in job)
- 15-07: getMetrics derives lightweight summary from full profile (no separate DB query)
- 15-07: getGlobalActivity input is fully optional (entire object optional)
- 15-08: Naming convention use-profile-queries.ts matches existing use-*-queries.ts pattern
- 15-08: staleTime 30s for profile/metrics (slow-changing), 10s for activity (fast-changing)
- 15-08: useInvalidateProfile invalidates all profile keys (broad invalidation)
- 15-09: Top 6 topics + "Other" aggregation in ProfileTopics for pie chart readability
- 15-09: Configurable maxHeight on ActivityLog for reuse in different layout contexts
- 15-09: Client-side types mirroring API types (components accept plain props without importing from @trend-x/api)
- 15-10: ProfileSection uses job.trigger with profile_update type (fingerprint router was removed)
- 15-10: Dead fingerprint-related files deleted immediately (caused build failures from removed router)
- 15-10: Global activity limited to 30 entries with 300px max height on overview dashboard
- 15-11: changeDetectionRun kept as legacy table (notifications FK to it); fingerprintId made nullable
- 15-11: Notification router simplified: direct change lookup instead of multi-table fingerprint join
- 15-11: Shared UI components (sentiment-bar, sample-tweets, empty-state) deleted since only used by fingerprint components
- 15-11: Pipeline type enum updated from "fingerprint" to "profile_update" across job router, run controls, run history
- 15-12: Six accordion sections covering full live profile architecture (replaced fingerprint docs)
- 15-12: Sub-sections within Live Profile Analysis for classification, evolution, and personality
- 15-12: All fingerprint terminology replaced with profile terminology in documentation
- 15-13: Verification-only plan with no code changes (build + schema + integration point checks)

**Phase 16 Decisions:**
- 16-01: Composite unique index on (accountId, userId, direction) for upsert pattern
- 16-01: Individual update loops for removed connections instead of batch inArray (simpler for SQLite)
- 16-01: Early-stop carries over previous IDs to avoid false removal detection on partial fetches
- 16-01: Mutual connections stored as direction="mutual" (single row, not dual following+follower)
- 16-02: Template-based explanations instead of LLM calls for social signals (speed over polish)
- 16-02: 20% threshold for follower spike/drop, 30% for following spike (stricter than profile detection)
- 16-02: Notable follower: isBlueVerified OR followerCount > 10,000
- 16-02: Mutual connection detection checks both directions (new following who is follower, new follower who is followed)
- 16-02: maxConcurrent: 1 for social_snapshot jobs (Twitter API rate limit safety)

### Pending Todos

1. **Reliable pipeline execution and communication** (area: api) — SSE unreliability on reload, no queuing/cancellation, no reconnection strategy, process isolation concerns

### Roadmap Evolution

- Phase 10 added: Improved AI Setup
- Phase 11 added: Documentation Page
- Phase 12 added: General Dashboard Page
- Phase 13 added: Analysis State Machine
- Phase 14 added: Job Runner (DB-driven job framework replacing in-memory state machine + SSE)
- Phase 15 added: Live Account Profiles (replace batch fingerprints with incremental live profiles + personality model)
- Phase 16 added: Social Graph and Social signals based on followers

### Blockers/Concerns

**From Research:**
- LLM venture signal detection deferred to v2.1 (VS-01, VS-02)
- No severity classification — all detected changes are significant enough to notify

**Technical Debt from v1.0:**
- Pre-existing TypeScript warnings (unused variables) across multiple files
- Pre-existing error in bird.ts (line 80)

### Quick Tasks Completed

| #   | Description                                      | Date       | Commit | Directory                                                                 |
|-----|--------------------------------------------------|------------|--------|----------------------------------------------------------------------------|
| 001 | Fix ingest and bird type/lint errors             | 2026-02-04 | 2ba4d08 | [001-fix-ingest-and-bird-type-errors](./quick/001-fix-ingest-and-bird-type-errors/) |
| 002 | Change the font to Geist Mono (shadcn/Next.js)   | 2026-02-04 | 9415d95 | [002-change-font-to-geist-mono](./quick/002-change-font-to-geist-mono/) |
| 003 | Streamline dashboard layout (sections + tabs)    | 2026-02-05 | 5710535 | [003-streamline-dashboard-layout](./quick/003-streamline-dashboard-layout/) |
| 004 | Improve setup wizard stepper (UI polish)         | 2026-02-05 | 1042057 | [004-improve-setup-wizard-stepper](./quick/004-improve-setup-wizard-stepper/) |
| 005 | Centralize React Query hooks                     | 2026-02-05 | 946d53c | [005-centralize-react-query-hooks](./quick/005-centralize-react-query-hooks/) |
| 006 | Improve header navigation                        | 2026-02-06 | 5077e57 | [006-improve-header-navigation](./quick/006-improve-header-navigation/) |
| 007 | Generate personality avatar art                  | 2026-02-06 | 0f2d41d | [007-generate-personality-avatar-art](./quick/007-generate-personality-avatar-art/) |

## Session Continuity

Last session: 2026-02-11 (Phase 16 Plan 02 - Social Signal Detection + Snapshot Job)
Stopped at: Completed 16-02-PLAN.md
Resume file: None

**Next action:** Execute 16-03-PLAN.md (next plan in Phase 16)
