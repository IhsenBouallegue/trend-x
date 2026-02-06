"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityLog } from "@/components/profile/activity-log";
import { PersonalityRadar } from "@/components/profile/personality-radar";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { ProfileTopics } from "@/components/profile/profile-topics";

import { useProfile, useProfileActivity, useInvalidateProfile, useScheduleList } from "@/hooks/queries";
import { trpc } from "@/utils/trpc";

interface ProfileSectionProps {
  accountId: string;
}

export function ProfileSection({ accountId }: ProfileSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useProfile(accountId);
  const { data: activity, isLoading: activityLoading } = useProfileActivity(accountId);
  const { data: schedules } = useScheduleList();
  const invalidateProfile = useInvalidateProfile();

  const nextScheduledAt = schedules
    ?.find((s) => s.jobType === "profile_update" && s.enabled)
    ?.nextRunAt ?? null;

  const refreshMutation = useMutation(
    trpc.job.trigger.mutationOptions({
      onSuccess: (data) => {
        invalidateProfile(accountId);
        // Set jobId in URL so the pipeline stepper shows progress
        const params = new URLSearchParams(searchParams.toString());
        params.set("jobId", data.jobId);
        router.replace(`?${params.toString()}`);
        toast.success("Profile update started");
      },
      onError: (error: { message: string }) => {
        toast.error(error.message || "Failed to update profile");
      },
    }),
  );

  if (profileLoading) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-xl">Live Profile</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Incrementally updated behavioral profile based on tweet activity.
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refreshMutation.mutate({ accountId, jobType: "profile_update" })}
                    disabled={refreshMutation.isPending}
                  >
                    {refreshMutation.isPending ? (
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 size-3.5" />
                    )}
                    Generate Profile
                  </Button>
                }
              />
              <TooltipContent>
                Fetch new tweets, classify topics, evaluate personality, and detect changes
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <EmptyState message="No profile exists yet. Click Generate Profile to get started." />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-xl">Live Profile</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Incrementally updated behavioral profile based on tweet activity.
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshMutation.mutate({ accountId, jobType: "profile_update" })}
                  disabled={refreshMutation.isPending}
                >
                  {refreshMutation.isPending ? (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-3.5" />
                  )}
                  Refresh
                </Button>
              }
            />
            <TooltipContent>
              Fetch new tweets, classify topics, evaluate personality, and detect changes
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Summary metrics */}
      <div className="border bg-card p-4">
        <ProfileSummary
          topicCount={profile.topics?.length ?? 0}
          totalTweetsProcessed={profile.totalTweetsProcessed}
          tweetsPerDay={profile.activityMetrics?.tweetsPerDay ?? null}
          lastUpdatedAt={profile.lastUpdatedAt}
          nextScheduledAt={nextScheduledAt}
        />
      </div>

      {/* Topics */}
      <div className="border bg-card p-4">
        <h3 className="mb-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Topics</h3>
        {profile.topics && profile.topics.length > 0 ? (
          <ProfileTopics topics={profile.topics} />
        ) : (
          <EmptyState message="No topics detected yet" />
        )}
      </div>

      {/* Personality */}
      <div className="border bg-card p-4">
        <h3 className="mb-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Personality</h3>
        {profile.personality ? (
          <PersonalityRadar
            scores={profile.personality.scores}
            summary={profile.personality.summary}
            values={profile.personality.values}
          />
        ) : (
          <EmptyState message="No personality evaluation yet" />
        )}
      </div>

      {/* Activity */}
      <div className="border bg-card p-4">
        <h3 className="mb-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Activity</h3>
        {activityLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <ActivityLog entries={activity ?? []} maxHeight="400px" />
        )}
      </div>
    </section>
  );
}
