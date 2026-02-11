"use client";

import { Bug, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAccount } from "@/contexts/account-context";
import { useDeleteSocialData } from "@/hooks/queries";
import { Button } from "@/components/ui/button";

export function DevToolsFloat() {
  const [open, setOpen] = useState(false);
  const { selectedAccountId } = useAccount();
  const [confirmingSocial, setConfirmingSocial] = useState(false);

  const deleteSocial = useDeleteSocialData({
    onSuccess: () => {
      toast.success("Social data deleted");
      setConfirmingSocial(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete social data");
      setConfirmingSocial(false);
    },
  });

  return (
    <div className="fixed top-4 left-4 z-50">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 shadow-md"
        onClick={() => setOpen(!open)}
      >
        <Bug className="h-4 w-4" />
      </Button>

      {open && (
        <div className="mt-2 w-72 border bg-card p-3 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dev Tools</span>
            <button type="button" onClick={() => { setOpen(false); setConfirmingSocial(false); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-1">
              Account: {selectedAccountId ? <span className="text-foreground font-mono">{selectedAccountId.slice(0, 8)}</span> : <span className="text-destructive">none selected</span>}
            </div>

            {confirmingSocial ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => setConfirmingSocial(false)} disabled={deleteSocial.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => {
                    if (selectedAccountId) {
                      deleteSocial.mutate({ accountId: selectedAccountId });
                    }
                  }}
                  disabled={!selectedAccountId || deleteSocial.isPending}
                >
                  {deleteSocial.isPending ? "Deleting..." : "Confirm"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full justify-start text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmingSocial(true)}
                disabled={!selectedAccountId}
              >
                <Trash2 className="mr-1.5 h-3 w-3" />
                Delete social data
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
