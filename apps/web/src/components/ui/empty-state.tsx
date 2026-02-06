import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] items-center justify-center border border-dashed p-6",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
