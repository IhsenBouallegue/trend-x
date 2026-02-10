import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

export function useSnapshotHistory(
  accountId: string | null,
  limit?: number,
) {
  return useQuery({
    ...trpc.social.getSnapshotHistory.queryOptions({
      accountId: accountId || "",
      limit,
    }),
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

export function useFollowerChart(
  accountId: string | null,
  days?: number,
) {
  return useQuery({
    ...trpc.social.getFollowerChart.queryOptions({
      accountId: accountId || "",
      days,
    }),
    enabled: !!accountId,
    staleTime: 60_000,
  });
}

export function useSocialConnections(
  accountId: string | null,
  direction?: "following" | "follower" | "mutual",
  notableOnly?: boolean,
) {
  return useQuery({
    ...trpc.social.getConnections.queryOptions({
      accountId: accountId || "",
      direction,
      notableOnly,
    }),
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

export function useRecentChanges(
  accountId: string | null,
  limit?: number,
) {
  return useQuery({
    ...trpc.social.getRecentChanges.queryOptions({
      accountId: accountId || "",
      limit,
    }),
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

export function useSocialGraph(accountId?: string | null) {
  return useQuery({
    ...trpc.social.getGraphData.queryOptions({
      accountId: accountId || undefined,
    }),
    staleTime: 60_000,
  });
}

export function useSocialStats(accountId: string | null) {
  return useQuery({
    ...trpc.social.getStats.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

export function useInvalidateSocial() {
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.social.all });
  }, []);
}
