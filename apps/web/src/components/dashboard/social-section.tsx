"use client";

import { SocialStats } from "@/components/social/social-stats";
import { FollowerChart } from "@/components/social/follower-chart";
import { FollowerChanges } from "@/components/social/follower-changes";
import { SocialGraph } from "@/components/social/social-graph";

interface SocialSectionProps {
  accountId: string;
}

export function SocialSection({ accountId }: SocialSectionProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-semibold text-xl">Social Graph</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Follower and following relationship tracking with change detection.
        </p>
      </div>

      {/* Stats row */}
      <SocialStats accountId={accountId} />

      {/* Two-column layout for chart and changes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FollowerChart accountId={accountId} />
        <FollowerChanges accountId={accountId} />
      </div>

      {/* Full-width graph visualization */}
      <SocialGraph accountId={accountId} />
    </section>
  );
}
