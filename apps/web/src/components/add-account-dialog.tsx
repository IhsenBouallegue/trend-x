"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCreateAccount } from "@/hooks/queries";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const [handle, setHandle] = useState("");

  const createAccountMutation = useCreateAccount({
    onSuccess: () => {
      toast.success("Account added");
      setHandle("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to add account: ${error.message}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = handle.trim();
    if (!cleanHandle) {
      toast.error("Please enter a Twitter handle");
      return;
    }
    await createAccountMutation.mutateAsync({ handle: cleanHandle });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add Account</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the Twitter handle of the account you want to monitor.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={handleSubmit}>
          <Field className="mb-4">
            <FieldLabel htmlFor="new-account-handle">Twitter Handle</FieldLabel>
            <Input
              id="new-account-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@username or username"
              autoFocus
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancel</AlertDialogCancel>
            <Button type="submit" disabled={createAccountMutation.isPending}>
              {createAccountMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Account
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
