import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:pl-64">
      <AppNav />
      <main className="mx-auto w-full max-w-2xl px-4 pt-5 pb-[calc(var(--tabbar-height)+2rem)] sm:px-6 lg:pt-10 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
