"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@trend-x/api/routers/index";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type JobRun = RouterOutputs["job"]["getActiveRuns"][number];

export function useActiveJobs(accountId: string | null) {
  const [recentlyCompleted, setRecentlyCompleted] = useState<Map<string, JobRun>>(new Map());
  const prevActiveIdsRef = useRef<Set<string>>(new Set());

  const { data: activeRuns, isLoading } = useQuery({
    ...trpc.job.getActiveRuns.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    refetchInterval: (query) => {
      const runs = query.state.data;
      return runs && runs.length > 0 ? 1000 : false;
    },
    staleTime: 0,
  });

  // Track jobs that disappear from active runs (they completed/failed)
  useEffect(() => {
    if (!activeRuns || !accountId) return;

    const currentActiveIds = new Set(activeRuns.map((r) => r.id));
    const prevIds = prevActiveIdsRef.current;

    // Find IDs that were active before but aren't anymore
    for (const id of prevIds) {
      if (!currentActiveIds.has(id)) {
        // Job finished — fetch its final state
        void fetchCompletedJob(id);
      }
    }

    prevActiveIdsRef.current = currentActiveIds;
  }, [activeRuns, accountId]);

  const fetchCompletedJob = useCallback(
    async (jobId: string) => {
      try {
        const result = await queryClient.fetchQuery({
          ...trpc.job.getDetails.queryOptions({ jobId }),
          staleTime: 0,
        });
        if (result) {
          setRecentlyCompleted((prev) => new Map(prev).set(jobId, result as JobRun));
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: queryKeys.tweet.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.overview.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.notification.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.social.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
        }
      } catch {
        // Job details fetch failed, just ignore
      }
    },
    [],
  );

  const dismissCompleted = useCallback((jobId: string) => {
    setRecentlyCompleted((prev) => {
      const next = new Map(prev);
      next.delete(jobId);
      return next;
    });
  }, []);

  // Merge active runs + recently completed for display
  const allVisibleJobs: JobRun[] = [
    ...(activeRuns || []),
    ...Array.from(recentlyCompleted.values()),
  ];

  return { allVisibleJobs, dismissCompleted, isLoading };
}
