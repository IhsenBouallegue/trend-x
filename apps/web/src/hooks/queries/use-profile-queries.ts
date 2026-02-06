import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

export function useProfile(accountId: string | null) {
  return useQuery({
    ...trpc.profile.getProfile.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

export function useProfileActivity(accountId: string | null, limit?: number) {
  return useQuery({
    ...trpc.profile.getActivity.queryOptions({
      accountId: accountId || "",
      limit,
    }),
    enabled: !!accountId,
    staleTime: 10_000,
  });
}

export function useGlobalActivity(limit?: number) {
  return useQuery({
    ...trpc.profile.getGlobalActivity.queryOptions({
      limit,
    }),
    staleTime: 10_000,
  });
}

export function useProfileMetrics(accountId: string | null) {
  return useQuery({
    ...trpc.profile.getMetrics.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

export function useInvalidateProfile() {
  return useCallback((accountId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
  }, []);
}
