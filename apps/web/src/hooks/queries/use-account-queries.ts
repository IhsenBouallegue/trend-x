import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

export function useAccountList() {
  return useQuery(trpc.account.list.queryOptions());
}

export function useAccountCount() {
  return useQuery(trpc.account.count.queryOptions());
}

export function useCreateAccount(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.account.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.account.all });
        options?.onSuccess?.();
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}

export function useDeleteAccount(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.account.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.account.all });
        options?.onSuccess?.();
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}
