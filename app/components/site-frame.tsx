import type { ReactNode } from "react";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <main className="site-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
    </main>
  );
}
