"use client";

import { useState } from "react";

type SkillChipProps = {
  name: string;
  iconUrl?: string;
};

export function SkillChip({ name, iconUrl }: SkillChipProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className="pink-skill-chip"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered ? "translateY(-3px) scale(1.05)" : "translateY(0) scale(1)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {iconUrl ? (
        // Skill icons are user-managed and may be hosted on arbitrary domains.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          width={18}
          height={18}
          loading="lazy"
          style={{
            transform: isHovered ? "rotate(5deg) scale(1.1)" : "rotate(0) scale(1)",
            transition: "transform 0.3s ease",
          }}
        />
      ) : (
        <span className="pink-skill-dot" aria-hidden="true" />
      )}
      {name}
    </span>
  );
}
