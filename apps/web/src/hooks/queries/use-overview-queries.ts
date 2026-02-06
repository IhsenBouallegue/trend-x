import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function useOverviewMetrics() {
  return useQuery(trpc.overview.getMetrics.queryOptions());
}

export function useRecentActivity() {
  return useQuery(trpc.overview.getRecentActivity.queryOptions());
}

export function useNotificationTrend() {
  return useQuery(trpc.overview.getNotificationTrend.queryOptions());
}
