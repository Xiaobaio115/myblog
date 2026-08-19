"use client";

import { useEffect, useRef, useState } from "react";

type ScrollRevealProps = {
  mode: "heroFade" | "reveal";
  className?: string;
  children: React.ReactNode;
};

export function ScrollReveal({ mode, className, children }: ScrollRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    if (!root) return;

    if (mode === "heroFade") {
      // Measure the hero's document position before sticky positioning takes over.
      // Reading `getBoundingClientRect().top` on every scroll would stay constant
      // while the hero is pinned and the fade would never advance.
      const startY = root.getBoundingClientRect().top + window.scrollY;
      const travel = Math.max(1, root.getBoundingClientRect().height * 0.6);
      let raf = 0;
      const onScroll = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const progress = Math.max(0, Math.min(1, (window.scrollY - startY) / travel));
          root.style.setProperty("--scroll-progress", String(progress));
        });
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        cancelAnimationFrame(raf);
      };
    }

    if (mode === "reveal") {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(root);
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      observer.observe(root);
      return () => observer.disconnect();
    }
  }, [mode, reducedMotion]);

  const wrapperClass = mode === "heroFade" ? "hero-fade-root" : "scroll-reveal-root";
  const revealClass = mode === "reveal" && visible ? "scroll-reveal-visible" : "";

  return (
    <div
      ref={rootRef}
      className={`${wrapperClass} ${revealClass} ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}

export function useScrollReveal() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reducedMotion;
}
