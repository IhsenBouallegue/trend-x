"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { NotificationList } from "@/components/dashboard/notifications/notification-list";
import { OverviewDashboard } from "@/components/dashboard/overview/overview-dashboard";
import { PipelineProgress } from "@/components/dashboard/pipeline-progress";
import { ProfileSection } from "@/components/dashboard/profile-section";
import { RunControls } from "@/components/dashboard/run-controls";
import { RunHistory } from "@/components/dashboard/run-history";
import { SocialSection } from "@/components/dashboard/social-section";
import { TweetHeatmap } from "@/components/dashboard/tweet-heatmap";
import { useAccount } from "@/contexts/account-context";
import { useAccountCount, useAccountList, useConfigIsConfigured } from "@/hooks/queries";

export default function DashboardPage() {
  const router = useRouter();
  const { selectedAccountId } = useAccount();

  const { data: configStatus, isLoading: configLoading } = useConfigIsConfigured();

  const { data: accountCount, isLoading: accountLoading } = useAccountCount();

  const { data: accounts } = useAccountList();

  const isLoading = configLoading || accountLoading;

  useEffect(() => {
    if (!isLoading) {
      if (configStatus && !configStatus.configured) {
        router.push("/setup");
        return;
      }
      if (accountCount !== undefined && accountCount === 0) {
        router.push("/setup");
        return;
      }
    }
  }, [isLoading, configStatus, accountCount, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-muted" />
          <div className="h-32 bg-muted" />
        </div>
      </div>
    );
  }

  if (!configStatus?.configured || accountCount === 0) {
    return (
      <div className="container mx-auto max-w-5xl p-4">
        <div className="animate-pulse text-muted-foreground">Redirecting to setup...</div>
      </div>
    );
  }

  // If no account is selected, show overview dashboard
  if (!selectedAccountId) {
    return <OverviewDashboard />;
  }

  // Account-specific dashboard
  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  return (
    <div className="container mx-auto max-w-5xl space-y-10 p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold text-2xl">
            {selectedAccount ? `@${selectedAccount.handle}` : "Dashboard"}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">Live behavioral profile</p>
        </div>
        <RunControls />
      </div>

      {/* Pipeline progress */}
      <PipelineProgress />

      {/* Notifications section */}
      {selectedAccountId && <NotificationList accountId={selectedAccountId} />}

      {/* Live Profile section */}
      <ProfileSection accountId={selectedAccountId} />

      {/* Social Graph section */}
      <SocialSection accountId={selectedAccountId} />

      {/* Tweet activity heatmap */}
      <TweetHeatmap />

      {/* Pipeline run history */}
      <section className="space-y-6">
        <div>
          <h2 className="font-semibold text-xl">Pipeline History</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Past analysis and ingestion runs with step-by-step details.
          </p>
        </div>
        <RunHistory accountId={selectedAccountId} />
      </section>
    </div>
  );
}
