import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

export function useConfigAll() {
  return useQuery(trpc.config.getAll.queryOptions());
}

export function useConfigIsConfigured() {
  return useQuery(trpc.config.isConfigured.queryOptions());
}

export function useSetBulkConfig(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.config.setBulk.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
        options?.onSuccess?.();
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}

export function useSetTelegramConfig(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.config.setBulk.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.telegram.getStatus });
        options?.onSuccess?.();
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}

export function useTestTwitterCredentials(options?: {
  onSuccess?: (data: { success: boolean; name?: string; username?: string; error?: string }) => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.config.testTwitterCredentials.mutationOptions({
      onSuccess: options?.onSuccess,
      onError: (error) => options?.onError?.(error),
    }),
  );
}
