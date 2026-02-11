"use client";

import { Activity, Bell, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ActivityLog } from "@/components/profile/activity-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGlobalActivity,
  useNotificationTrend,
  useOverviewMetrics,
  useRecentActivity,
} from "@/hooks/queries";
import { CrossAccountGraph } from "./cross-account-graph";

const chartConfig = {
  count: {
    label: "Notifications",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function OverviewDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useOverviewMetrics();

  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();

  const { data: notificationTrend, isLoading: trendLoading } = useNotificationTrend();

  const { data: globalActivity, isLoading: globalActivityLoading } = useGlobalActivity(30);

  // Calculate recent changes (last 24 hours)
  const recentChangesCount =
    recentActivity?.filter((notification) => {
      const now = Math.floor(Date.now() / 1000);
      const twentyFourHoursAgo = now - 86400;
      return notification.createdAt > twentyFourHoursAgo;
    }).length ?? 0;

  return (
    <div className="space-y-10 py-4">
      {/* Header */}
      <div>
        <h1 className="font-bold text-2xl">Overview</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Monitoring {metrics?.totalAccounts ?? 0} account{metrics?.totalAccounts === 1 ? "" : "s"}
        </p>
      </div>

      {/* KPI Cards */}
      <section>
        <div className="grid gap-4 md:grid-cols-3">
          {metricsLoading ? (
            <>
              <Skeleton className="h-[120px]" />
              <Skeleton className="h-[120px]" />
              <Skeleton className="h-[120px]" />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="font-medium text-sm">Total Accounts</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="font-bold text-2xl">{metrics?.totalAccounts ?? 0}</div>
                  <p className="mt-1 text-muted-foreground text-xs">Monitored Twitter accounts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="font-medium text-sm">Total Notifications</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="font-bold text-2xl">{metrics?.totalNotifications ?? 0}</div>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {metrics?.totalUnread ?? 0} unread
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="font-medium text-sm">Recent Changes</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="font-bold text-2xl">{recentChangesCount}</div>
                  <p className="mt-1 text-muted-foreground text-xs">Last 24 hours</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </section>

      {/* Notification Trend Chart */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-xl">Notification Trend</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Daily notification frequency over the last 30 days
          </p>
        </div>

        {trendLoading ? (
          <Skeleton className="h-[300px]" />
        ) : !notificationTrend ||
          notificationTrend.length === 0 ||
          notificationTrend.every((d) => d.count === 0) ? (
          <Card>
            <CardContent className="flex h-[300px] items-center justify-center">
              <p className="text-muted-foreground text-sm">No notifications in the last 30 days</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={notificationTrend} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => Math.round(value).toString()}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={8} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recent Activity Feed */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-xl">Recent Activity</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Latest notifications across all monitored accounts
          </p>
        </div>

        {activityLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-[80px]" />
            ))}
          </div>
        ) : !recentActivity || recentActivity.length === 0 ? (
          <EmptyState message="No notifications yet. Run analysis on your accounts to start detecting changes." />
        ) : (
          <div className="space-y-2">
            {recentActivity.map((notification) => {
              const isUnread = notification.isRead === 0;
              const relativeTime = getRelativeTime(notification.createdAt);

              return (
                <Card
                  key={notification.id}
                  className={isUnread ? "border-l-4 border-l-primary" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex-shrink-0">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-muted-foreground text-xs">
                          @{notification.accountHandle} · {relativeTime}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="flex-shrink-0">
                          <div className="h-2 w-2 bg-primary" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Global Profile Activity */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-xl">Profile Activity</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Recent profile updates, topic classifications, and personality evaluations
          </p>
        </div>

        {globalActivityLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <ActivityLog entries={globalActivity ?? []} maxHeight="300px" />
        )}
      </section>

      {/* Social Overlap */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-xl">Social Overlap</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Connections shared between monitored accounts
          </p>
        </div>

        <CrossAccountGraph />
      </section>
    </div>
  );
}

// Helper function to format relative time
function getRelativeTime(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diffSeconds = now - unixTimestamp;

  if (diffSeconds < 60) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}
