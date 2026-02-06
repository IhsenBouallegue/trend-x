import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

export function useScheduleList() {
  return useQuery(trpc.schedule.list.queryOptions());
}

export function useUpdateSchedule(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.schedule.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all });
        options?.onSuccess?.();
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}
