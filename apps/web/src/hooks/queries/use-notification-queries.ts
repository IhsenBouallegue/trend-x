import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { queryKeys } from "./query-keys";

export function useNotificationsByAccount(accountId: string) {
  return useQuery(trpc.notification.getByAccount.queryOptions({ accountId }));
}

export function useUnreadCount(accountId: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...trpc.notification.getUnreadCount.queryOptions({ accountId }),
    enabled: options?.enabled ?? true,
  });
}

type NotificationData = {
  id: string;
  isRead: number;
  readAt: number | null;
  [key: string]: unknown;
};

export function useMarkAsRead(
  accountId: string,
  options?: {
    onError?: () => void;
    onSuccess?: () => void;
  },
) {
  return useMutation(
    trpc.notification.markAsRead.mutationOptions({
      onMutate: async ({ notificationId }) => {
        const queryKey = [["notification", "getByAccount"], { input: { accountId } }];
        await queryClient.cancelQueries({ queryKey });

        const previousNotifications = queryClient.getQueryData(queryKey);

        queryClient.setQueryData(queryKey, (old: unknown) => {
          if (!old) return old;
          return (old as NotificationData[]).map((n) =>
            n.id === notificationId
              ? { ...n, isRead: 1, readAt: Math.floor(Date.now() / 1000) }
              : n,
          );
        });

        return { previousNotifications };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousNotifications) {
          const queryKey = [["notification", "getByAccount"], { input: { accountId } }];
          queryClient.setQueryData(queryKey, context.previousNotifications);
        }
        options?.onError?.();
      },
      onSuccess: options?.onSuccess,
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.notification.all });
      },
    }),
  );
}

export function useMarkAllAsRead(
  accountId: string,
  options?: {
    onError?: () => void;
    onSuccess?: () => void;
  },
) {
  return useMutation(
    trpc.notification.markAllAsRead.mutationOptions({
      onMutate: async () => {
        const queryKey = [["notification", "getByAccount"], { input: { accountId } }];
        await queryClient.cancelQueries({ queryKey });

        const previousNotifications = queryClient.getQueryData(queryKey);

        queryClient.setQueryData(queryKey, (old: unknown) => {
          if (!old) return old;
          const now = Math.floor(Date.now() / 1000);
          return (old as NotificationData[]).map((n) => ({ ...n, isRead: 1, readAt: now }));
        });

        return { previousNotifications };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousNotifications) {
          const queryKey = [["notification", "getByAccount"], { input: { accountId } }];
          queryClient.setQueryData(queryKey, context.previousNotifications);
        }
        options?.onError?.();
      },
      onSuccess: options?.onSuccess,
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.notification.all });
      },
    }),
  );
}
