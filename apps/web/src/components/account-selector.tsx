"use client";

import { ChevronDown, LayoutDashboard, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount } from "@/contexts/account-context";
import { useAccountList, useDeleteAccount, useUnreadCount } from "@/hooks/queries";
import { cn } from "@/lib/utils";

function AccountMenuItem({
  account,
  canDelete,
  onSelect,
  onDelete,
}: {
  account: { id: string; handle: string };
  canDelete: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const { data: unreadCount } = useUnreadCount(account.id);

  return (
    <DropdownMenuItem className="flex items-center justify-between gap-2" onClick={onSelect}>
      <span className="flex items-center gap-2 truncate">
        <span className="truncate">@{account.handle}</span>
        {(unreadCount ?? 0) > 0 && (
          <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
            {(unreadCount ?? 0) > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </span>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="p-0.5 hover:bg-destructive/10"
          aria-label={`Delete ${account.handle}`}
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </DropdownMenuItem>
  );
}

export function AccountSelector() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { selectedAccountId, setSelectedAccountId } = useAccount();

  const { data: accounts, isLoading } = useAccountList();

  const { data: selectedUnreadCount } = useUnreadCount(selectedAccountId || "", {
    enabled: !!selectedAccountId,
  });

  const deleteAccountMutation = useDeleteAccount({
    onSuccess: () => toast.success("Account removed"),
    onError: (error) => toast.error(error.message),
  });

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);
  const canDelete = (accounts?.length ?? 0) > 1;

  const handleSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const handleOverviewSelect = () => {
    setSelectedAccountId(null);
  };

  const handleDelete = async (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation();
    await deleteAccountMutation.mutateAsync({ id: accountId });
  };

  if (isLoading || !accounts || accounts.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
        >
          <span className="flex max-w-[150px] items-center gap-1.5">
            <span className="truncate">
              {selectedAccount ? `@${selectedAccount.handle}` : "Overview"}
            </span>
            {(selectedUnreadCount ?? 0) > 0 && (
              <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                {(selectedUnreadCount ?? 0) > 9 ? "9+" : selectedUnreadCount}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuItem onClick={handleOverviewSelect}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Overview
            {!selectedAccountId && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {accounts.map((account) => (
            <AccountMenuItem
              key={account.id}
              account={account}
              canDelete={canDelete}
              onSelect={() => handleSelect(account.id)}
              onDelete={(e) => handleDelete(e, account.id)}
            />
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddAccountDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
}
