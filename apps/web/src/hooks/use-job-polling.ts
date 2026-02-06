"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { trpc } from "@/utils/trpc";

export function useJobPolling() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery({
    ...trpc.job.getDetails.queryOptions({ jobId: jobId! }),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll every 1 second while active, stop when terminal
      return (status === "running" || status === "queued") ? 1000 : false;
    },
    staleTime: 0,
  });

  // Invalidate related queries when job completes
  useEffect(() => {
    if (job?.status === "completed") {
      queryClient.invalidateQueries({ queryKey: [["profile"]] });
      queryClient.invalidateQueries({ queryKey: [["job"]] });
      queryClient.invalidateQueries({ queryKey: [["pipeline"]] });
    }
    if (job?.status === "failed") {
      queryClient.invalidateQueries({ queryKey: [["job"]] });
      queryClient.invalidateQueries({ queryKey: [["pipeline"]] });
    }
  }, [job?.status, queryClient]);

  return { job, jobId, isLoading };
}
