"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/account-context";
import { trpc } from "@/utils/trpc";

export function RunAnalysisButton() {
  const { selectedAccountId } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();

  const mutation = useMutation(
    trpc.job.trigger.mutationOptions({
      onSuccess: (data) => {
        // Set jobId in URL params for polling
        const params = new URLSearchParams(searchParams.toString());
        params.set("jobId", data.jobId);
        router.replace(`?${params.toString()}`);
      },
      onError: (error) => {
        toast.error(error?.message || "Failed to start pipeline");
      },
    })
  );

  const isDisabled = !selectedAccountId || mutation.isPending;

  return (
    <Button
      onClick={() => {
        if (!selectedAccountId) return;
        mutation.mutate({
          accountId: selectedAccountId,
          jobType: "profile_update",
        });
      }}
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
        "Run Analysis"
      )}
    </Button>
  );
}
