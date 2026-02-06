"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotificationsByAccount,
} from "@/hooks/queries";
import { ChangeDetail } from "./change-detail";
import { EvidenceTweets } from "./evidence-tweets";
import { NotificationItem } from "./notification-item";

interface NotificationListProps {
  accountId: string;
}

type Notification = {
  id: string;
  title: string;
  explanation: string;
  changeType: string;
  isRead: number;
  createdAt: number;
  change: {
    id: string;
    type: string;
    dimension: string;
    beforeValue: string | null;
    afterValue: string;
    explanation: string;
    evidence: {
      tweetIds: string[];
    };
  } | null;
};

export function NotificationList({ accountId }: NotificationListProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch notifications
  const { data: notifications, isLoading } = useNotificationsByAccount(accountId);

  // Mark single as read mutation
  const markAsReadMutation = useMarkAsRead(accountId, {
    onError: () => {
      toast.error("Failed to mark notification as read");
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMarkAllAsRead(accountId, {
    onError: () => {
      toast.error("Failed to mark all notifications as read");
    },
    onSuccess: () => {
      toast.success("All notifications marked as read");
    },
  });

  const handleCardClick = (notification: Notification) => {
    setSelectedId(notification.id);
    setSheetOpen(true);

    if (notification.isRead === 0) {
      markAsReadMutation.mutate({ notificationId: notification.id });
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate({ accountId });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="border-b pb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-[200px] w-[220px]" />
          <Skeleton className="h-[200px] w-[220px]" />
        </div>
      </div>
    );
  }

  // No notifications - don't render anything
  if (!notifications || notifications.length === 0) {
    return null;
  }

  const unreadCount = notifications.filter((n) => n.isRead === 0).length;
  const selected = notifications.find((n) => n.id === selectedId);

  return (
    <div className="border-b pb-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-xl">
            <Bell className="size-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Detected behavioral changes and anomalies. Select a notification to view details.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsReadMutation.isPending}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notification cards */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            isActive={sheetOpen && selectedId === notification.id}
            onClick={() => handleCardClick(notification)}
          />
        ))}
      </div>

      {/* Detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          {selected ? (
            <div className="space-y-6">
              <div>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>{selected.explanation}</SheetDescription>
              </div>

              {selected.change && (
                <>
                  <ChangeDetail
                    changeType={selected.change.type}
                    dimension={selected.change.dimension}
                    beforeValue={selected.change.beforeValue}
                    afterValue={selected.change.afterValue}
                    explanation={selected.change.explanation}
                  />

                  <EvidenceTweets tweetIds={selected.change.evidence.tweetIds} />
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
