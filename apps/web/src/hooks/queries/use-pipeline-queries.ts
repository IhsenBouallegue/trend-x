import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function useRunHistory(accountId: string) {
  return useQuery(trpc.job.getHistory.queryOptions({ accountId, limit: 20 }));
}
