import type { ReactNode } from "react";
import { SiteHeader } from "@/app/components/site-header";

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <main className="site-shell">
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="orb orb3" />
      </div>
      <SiteHeader />
      {children}
    </main>
  );
}
