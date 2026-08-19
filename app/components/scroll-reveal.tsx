"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./scroll-reveal.module.css";

type ScrollRevealProps = {
  mode: "heroFade" | "stickyHero" | "reveal";
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

    if (mode === "heroFade" || mode === "stickyHero") {
      const startY = root.getBoundingClientRect().top + window.scrollY;
      let travel = Math.max(1, root.getBoundingClientRect().height * 0.72);
      let raf = 0;
      const setProgress = () => {
        const progress = Math.max(0, Math.min(1, (window.scrollY - startY) / travel));
        root.style.setProperty("--scroll-progress", String(progress));
        root.style.setProperty("--hero-copy-opacity", String(Math.max(0, 1 - progress * 1.55)));
        root.style.setProperty("--hero-copy-shift", `${progress * -68}px`);
        root.style.setProperty("--hero-media-shift", `${progress * 42}px`);
        root.style.setProperty("--hero-media-scale", String(1 + progress * 0.045));
        root.style.setProperty("--hero-shade-opacity", String(Math.min(1, 0.86 + progress * 0.14)));
        root.style.setProperty("--hero-root-opacity", String(Math.max(0.22, 1 - progress * 0.78)));
        root.style.setProperty("--hero-root-shift", `${progress * 38}px`);
      };
      const onScroll = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(setProgress);
      };
      const onResize = () => {
        travel = Math.max(1, root.getBoundingClientRect().height * 0.72);
        onScroll();
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
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

  const wrapperClass = mode === "heroFade"
    ? styles.heroFadeRoot
    : mode === "stickyHero"
      ? styles.stickyHeroRoot
      : styles.scrollRevealRoot;
  const revealClass = mode === "reveal" && visible ? styles.scrollRevealVisible : "";

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
