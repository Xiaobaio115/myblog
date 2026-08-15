"use client";

import { useEffect, useRef } from "react";

type ScrollAnimatedListProps = {
  children: React.ReactNode;
  staggerDelay?: number;
};

export function ScrollAnimatedList({ children, staggerDelay = 100 }: ScrollAnimatedListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = listRef.current?.children;
    if (!items) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -100px 0px",
      }
    );

    Array.from(items).forEach((item, index) => {
      item.classList.add("scroll-fade-item");
      (item as HTMLElement).style.transitionDelay = `${index * staggerDelay}ms`;
      observer.observe(item);
    });

    return () => observer.disconnect();
  }, [staggerDelay]);

  return (
    <div ref={listRef} className="scroll-animated-list">
      {children}
    </div>
  );
}
