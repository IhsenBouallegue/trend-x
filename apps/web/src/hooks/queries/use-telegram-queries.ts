import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

export function useTelegramStatus() {
  return useQuery(trpc.telegram.getStatus.queryOptions());
}

export function useFetchChatId(options?: {
  onSuccess?: (data: { chatId: string }) => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.telegram.fetchChatId.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.telegram.getStatus });
        options?.onSuccess?.(data);
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}

export function useSendTestMessage(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.telegram.sendTestMessage.mutationOptions({
      onSuccess: options?.onSuccess,
      onError: (error) => options?.onError?.(error),
    }),
  );
}

export function useToggleTelegramEnabled(options?: {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}) {
  return useMutation(
    trpc.telegram.toggleEnabled.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.telegram.getStatus });
        options?.onSuccess?.();
      },
      onError: (error) => options?.onError?.(error),
    }),
  );
}
