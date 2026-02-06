import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function useTweetsByIds(ids: string[], enabled = true) {
  return useQuery({
    ...trpc.tweet.getByIds.queryOptions({ ids }),
    enabled: ids.length > 0 && enabled,
  });
}

export function useTweetActivity(accountId: string | null) {
  return useQuery({
    ...trpc.tweet.getActivityCalendar.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
  });
}

export function useTweetsByDate(
  accountId: string | null,
  date: string | null,
  enabled = true,
) {
  return useQuery({
    ...trpc.tweet.getByDate.queryOptions({
      accountId: accountId || "",
      date: date || "",
    }),
    enabled: !!accountId && !!date && enabled,
  });
}
