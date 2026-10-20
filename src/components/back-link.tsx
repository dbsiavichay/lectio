import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      className="-ml-1.5 inline-flex h-9 items-center gap-0.5 rounded-lg pr-2 pl-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <ChevronLeft className="size-4" /> {children}
    </Link>
  );
}
