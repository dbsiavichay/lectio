"use client";

import { BookOpen, CalendarCheck, Ellipsis, Repeat, Target, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { Route } from "next";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

type Item = { href: Route; label: string; icon: LucideIcon; match: (path: string) => boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Hoy", icon: CalendarCheck, match: (p) => p === "/" },
  {
    href: "/libro",
    label: "Libro",
    icon: BookOpen,
    match: (p) => p.startsWith("/libro") && !/\/(diario|metodo)/.test(p),
  },
  { href: "/repasos", label: "Repasos", icon: Repeat, match: (p) => p.startsWith("/repasos") },
  {
    href: "/compromisos",
    label: "Compromisos",
    icon: Target,
    match: (p) => p.startsWith("/compromisos"),
  },
  {
    href: "/mas",
    label: "Más",
    icon: Ellipsis,
    match: (p) =>
      ["/mas", "/ajustes", "/admin", "/libros"].some((x) => p.startsWith(x)) ||
      /\/(diario|metodo)/.test(p),
  },
];

/** Bottom tab bar on phones, sidebar from 1024 px. */
export function AppNav() {
  return (
    <Suspense fallback={<NavFrame pathname="" />}>
      <ActiveNav />
    </Suspense>
  );
}

// The pathname of a dynamic route is only known at request time.
function ActiveNav() {
  return <NavFrame pathname={usePathname()} />;
}

function NavFrame({ pathname }: { pathname: string }) {
  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-lg">
          {ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-accent",
                    )}
                  >
                    <item.icon className="size-5" strokeWidth={active ? 2.3 : 1.9} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo className="size-9" />
          <span className="font-serif text-xl font-semibold tracking-tight">Lectio</span>
        </Link>
        <ul className="space-y-1">
          {ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
