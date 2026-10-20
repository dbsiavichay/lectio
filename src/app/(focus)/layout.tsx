import type { ReactNode } from "react";

/** Sessions and reviews take the whole screen: no tab bar, nothing else to tap. */
export default function FocusLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
