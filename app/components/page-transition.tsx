"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // 页面切换时添加淡入动画
    document.body.style.opacity = "0";
    document.body.style.transform = "translateY(10px)";

    requestAnimationFrame(() => {
      document.body.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      document.body.style.opacity = "1";
      document.body.style.transform = "translateY(0)";
    });

    return () => {
      document.body.style.transition = "";
    };
  }, [pathname]);

  return <>{children}</>;
}
