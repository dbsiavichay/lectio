import type { ReactNode } from "react";

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}
