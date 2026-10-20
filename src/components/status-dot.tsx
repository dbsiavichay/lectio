import { Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

type Status = "not_started" | "in_progress" | "needs_review" | "completed";

export const STATUS_LABEL: Record<Status, string> = {
  not_started: "Sin empezar",
  in_progress: "En curso",
  needs_review: "Por reforzar",
  completed: "Completado",
};

/** A numbered badge colored by progress. */
export function StatusBadge({
  status,
  children,
  className,
}: {
  status: Status;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
        status === "completed" && "bg-success text-white",
        status === "in_progress" && "bg-accent text-accent-foreground ring-2 ring-primary/50",
        status === "needs_review" && "bg-warning text-warning-foreground",
        status === "not_started" && "bg-muted text-muted-foreground",
        className,
      )}
      aria-label={STATUS_LABEL[status]}
    >
      {status === "completed" && !children ? (
        <Check className="size-5" />
      ) : status === "needs_review" && !children ? (
        <RotateCcw className="size-4" />
      ) : (
        children
      )}
    </span>
  );
}
