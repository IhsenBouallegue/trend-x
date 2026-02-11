import { useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  limit?: number,
) {
  return useQuery({
    ...trpc.social.getConnections.queryOptions({
      accountId: accountId || "",
      direction,
      notableOnly,
      limit,
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

export function useCrossAccountGraph() {
  return useQuery({
    ...trpc.social.getCrossAccountGraph.queryOptions(),
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

export function useDeleteSocialData(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.social.deleteData.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.social.all });
        options?.onSuccess?.();
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}

export function useInvalidateSocial() {
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.social.all });
  }, []);
}
