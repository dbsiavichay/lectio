"use client";

import { Info, Lightbulb, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import { Markdown } from "./markdown";

/** The notebook's callouts. Safety notes stand out; optional extras stay quiet. */
export function Note({ md }: { md: string }) {
  const lower = md.toLowerCase();
  const warning = /seguridad|violencia|nunca debe golpear|médic|diagn/.test(lower);
  const extra = /complemento opcional/.test(lower);
  const Icon = warning ? ShieldAlert : extra ? Lightbulb : Info;
  return (
    <aside
      className={cn(
        "flex gap-3 rounded-xl p-4 text-sm",
        warning
          ? "bg-destructive/8 text-foreground ring-1 ring-destructive/25"
          : extra
            ? "bg-muted"
            : "bg-accent/60",
      )}
    >
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", warning ? "text-destructive" : "text-primary")}
        aria-hidden
      />
      <Markdown md={md} className="min-w-0 flex-1 [font-size:calc(var(--reading-size)*0.92)]" />
    </aside>
  );
}
