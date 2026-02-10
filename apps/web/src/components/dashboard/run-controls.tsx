"use client";

import { ChevronDown, Loader2, RefreshCw, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount } from "@/contexts/account-context";
import { trpc } from "@/utils/trpc";

export function RunControls() {
  const { selectedAccountId } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();

  const mutation = useMutation(
    trpc.job.trigger.mutationOptions({
      onSuccess: (data) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("jobId", data.jobId);
        router.replace(`?${params.toString()}`);
      },
      onError: (error: { message: string }) => {
        toast.error(error?.message || "Failed to start job");
      },
    })
  );

  const isDisabled = !selectedAccountId || mutation.isPending;

  function triggerJob(jobType: "profile_update" | "social_snapshot") {
    if (!selectedAccountId) return;
    mutation.mutate({ accountId: selectedAccountId, jobType });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => triggerJob("profile_update")}
        disabled={isDisabled}
        size="sm"
        variant="default"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Run Analysis
          </>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isDisabled}
          render={
            <Button size="sm" variant="outline" disabled={isDisabled}>
              <ChevronDown className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => triggerJob("profile_update")}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Run Analysis
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerJob("social_snapshot")}>
            <Users className="mr-2 h-4 w-4" />
            Social Snapshot
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** @deprecated Use RunControls instead */
export function RunAnalysisButton() {
  return <RunControls />;
}
