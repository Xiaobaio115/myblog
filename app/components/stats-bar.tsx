"use client";

import { AnimatedCounter } from "./animated-counter";

type StatsBarProps = {
  stats: Array<{ label: string; value: number }>;
};

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="stats">
      {stats.map((item) => (
        <AnimatedCounter key={item.label} end={item.value} label={item.label} />
      ))}
    </div>
  );
}
