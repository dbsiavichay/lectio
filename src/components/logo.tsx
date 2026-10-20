import { cn } from "@/lib/utils";

/** An open book with a bookmark: Lectio's mark. Inherits the primary color. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("text-primary", className)}>
      <rect x="2" y="2" width="44" height="44" rx="12" className="fill-primary" />
      <path
        d="M24 15.5c-3.4-2.3-7.6-3-11.5-2.4v19.6c3.9-.6 8.1.1 11.5 2.4 3.4-2.3 7.6-3 11.5-2.4V13.1c-3.9-.6-8.1.1-11.5 2.4Z"
        className="fill-primary-foreground/95"
      />
      <path d="M24 15.5v19.6" className="stroke-primary" strokeWidth="1.6" />
      <path d="M29.5 12.6v8.6l2.4-1.6 2.4 1.6v-9.3" className="fill-warning" />
    </svg>
  );
}
