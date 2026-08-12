"use client";

import { SkillChip } from "./skill-chip";

type Skill = {
  name: string;
  iconUrl?: string;
};

type SkillsPreviewProps = {
  skills: Skill[];
};

export function SkillsPreview({ skills }: SkillsPreviewProps) {
  return (
    <div className="pink-skill-preview">
      {skills.map((skill, index) => (
        <div
          key={skill.name}
          className="animate-fade-in-up"
          style={{
            animationDelay: `${index * 0.05}s`,
          }}
        >
          <SkillChip name={skill.name} iconUrl={skill.iconUrl} />
        </div>
      ))}
    </div>
  );
}
