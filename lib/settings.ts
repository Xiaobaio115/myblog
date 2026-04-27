import { getDb } from "@/lib/mongodb";
import { profile as defaultProfile, socials as defaultSocials, skills as defaultSkills, education as defaultEducation } from "@/data/profile";
import { projects as defaultProjects } from "@/data/projects";
import { travelDestinations as defaultTravel, gamesList as defaultGames, worldSections as defaultWorldSections } from "@/data/world";

export type ProfileSetting = {
  name: string;
  tagline: string;
  intro: string;
  status: string;
  location: string;
  email: string;
  githubUrl: string;
  avatarUrl: string;
};

export type SocialItem = { label: string; value: string; href: string };
export type SkillGroup = { group: string; items: string[] };
export type EducationItem = { time: string; title: string; desc: string; tags: string[] };
export type ProjectItem = { title: string; status: string; desc: string; stack: string[]; href: string };
export type TravelItem = { id: string; name: string; date: string; desc: string; cover: string; photos: string[]; tags: string[]; sections: ContentSection[] };
export type GameItem = { id: string; name: string; type: string; date: string; desc: string; cover: string; tags: string[] };
export type ContentSection = { caption: string; photos: string[]; tag?: string };
export type WorldSectionSetting = { id: string; eyebrow: string; title: string; desc: string; cover: string; icon: string; tags: string[]; photos: string[]; sections: ContentSection[] };

export type AllSettings = {
  profile: ProfileSetting;
  socials: SocialItem[];
  skills: SkillGroup[];
  education: EducationItem[];
  projects: ProjectItem[];
  travel: TravelItem[];
  games: GameItem[];
  world: WorldSectionSetting[];
};

async function get<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ key });
    if (doc?.value != null) return doc.value as T;
    return fallback;
  } catch {
    return fallback;
  }
}

export async function getProfileSetting(): Promise<ProfileSetting> {
  return get("profile", {
    name: defaultProfile.name,
    tagline: "Stay hungry, stay foolish.",
    intro: defaultProfile.intro,
    status: defaultProfile.status,
    location: defaultProfile.location,
    email: defaultProfile.email,
    githubUrl: defaultProfile.githubUrl,
    avatarUrl: defaultProfile.avatarUrl,
  });
}

export async function getSocialsSetting(): Promise<SocialItem[]> {
  return get("socials", defaultSocials);
}

export async function getSkillsSetting(): Promise<SkillGroup[]> {
  return get("skills", defaultSkills);
}

export async function getEducationSetting(): Promise<EducationItem[]> {
  return get("education", defaultEducation);
}

export async function getProjectsSetting(): Promise<ProjectItem[]> {
  return get("projects", defaultProjects);
}

export async function getTravelSetting(): Promise<TravelItem[]> {
  return get("travel", defaultTravel);
}

export async function getGamesSetting(): Promise<GameItem[]> {
  return get("games", defaultGames);
}

export async function getWorldSectionsSetting(): Promise<WorldSectionSetting[]> {
  const fallback: WorldSectionSetting[] = defaultWorldSections.map((s) => ({
    id: s.id,
    eyebrow: s.eyebrow,
    title: s.title,
    desc: s.desc,
    cover: s.cover,
    icon: s.icon,
    tags: s.tags,
    photos: [],
    sections: [],
  }));
  return get("world", fallback);
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key },
    { $set: { key, value, updatedAt: new Date() } },
    { upsert: true }
  );
}
