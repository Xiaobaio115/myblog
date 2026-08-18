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
  tags?: string[];
};

export type SocialItem = { label: string; value: string; href: string };
export type SkillItem = string | { name: string; iconUrl?: string };
export type SkillGroup = { group: string; items: SkillItem[] };
export type EducationItem = { time: string; title: string; desc: string; tags: string[] };
export type ProjectItem = { title: string; status: string; desc: string; stack: string[]; href: string };
export type TravelItem = { id: string; name: string; date: string; desc: string; cover: string; coverPosition?: string; photos: string[]; tags: string[]; sections: ContentSection[] };
export type GameItem = { id: string; name: string; type: string; date: string; desc: string; cover: string; tags: string[] };
export type ContentSection = { caption: string; photos: string[]; tag?: string };
export type WorldSectionSetting = { id: string; eyebrow: string; title: string; desc: string; cover: string; icon: string; tags: string[]; photos: string[]; sections: ContentSection[] };
export type HomeHeroSlideSetting = {
  id: string;
  imageUrl: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
};

export const DEFAULT_HOME_HERO_SLIDES: HomeHeroSlideSetting[] = [
  {
    id: "home-atlas",
    imageUrl: "/poetic-images/hero-home.jpg",
    imageAlt: "夜色中的远方与微光",
    eyebrow: "LQPP / PERSONAL ATLAS",
    title: "在代码与远方之间，收藏发光的日子",
    description: "把生活、技术和偶尔抵达的远方，收进一座持续生长的数字花园。",
    href: "/world",
    linkLabel: "进入我的世界",
  },
  {
    id: "world-map",
    imageUrl: "/poetic-images/hero-world.jpg",
    imageAlt: "山路穿过岩壁，延伸向远方",
    eyebrow: "01 / WORLD MAP",
    title: "把走过的路，写成坐标",
    description: "家乡、学校、旅行和游戏，组成一张可以慢慢散步的个人地图。",
    href: "/world/travel-map",
    linkLabel: "打开旅行地图",
  },
  {
    id: "memory-atlas",
    imageUrl: "/poetic-images/hero-photos.jpg",
    imageAlt: "被光留下的生活片段",
    eyebrow: "02 / MEMORY ATLAS",
    title: "把被光留下的瞬间，收藏成星图",
    description: "普通相册与 3D 星空墙，记录那些值得回看的光线。",
    href: "/photos",
    linkLabel: "打开记忆星图",
  },
];

export type AllSettings = {
  profile: ProfileSetting;
  socials: SocialItem[];
  skills: SkillGroup[];
  education: EducationItem[];
  projects: ProjectItem[];
  travel: TravelItem[];
  games: GameItem[];
  world: WorldSectionSetting[];
  homeHero: HomeHeroSlideSetting[];
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
    tags: defaultProfile.tags,
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

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function normalizeLink(value: unknown, fallback: string) {
  const link = stringValue(value, fallback).trim();
  if (!link) return fallback;
  if (link.startsWith("/") && !link.startsWith("//")) return link.slice(0, 500);

  try {
    const url = new URL(link);
    return ["http:", "https:"].includes(url.protocol) ? link.slice(0, 2000) : null;
  } catch {
    return null;
  }
}

export function normalizeHomeHeroSetting(value: unknown): HomeHeroSlideSetting[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) return null;

  const normalized: HomeHeroSlideSetting[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const fallback = DEFAULT_HOME_HERO_SLIDES[index] ?? DEFAULT_HOME_HERO_SLIDES[0];
    const href = normalizeLink(source.href, fallback.href);
    const imageUrl = stringValue(source.imageUrl, "").trim();
    if (href === null || imageUrl.length > 2000) return null;

    const fields = {
      id: stringValue(source.id, `home-slide-${index + 1}`).trim(),
      imageUrl,
      imageAlt: stringValue(source.imageAlt, fallback.imageAlt).trim(),
      eyebrow: stringValue(source.eyebrow, fallback.eyebrow).trim(),
      title: stringValue(source.title, fallback.title).trim(),
      description: stringValue(source.description, fallback.description).trim(),
      href,
      linkLabel: stringValue(source.linkLabel, fallback.linkLabel).trim(),
    };

    if (
      !fields.id || fields.id.length > 120 || fields.imageAlt.length > 300 ||
      fields.eyebrow.length > 160 || fields.title.length > 300 ||
      fields.description.length > 1200 || fields.linkLabel.length > 80
    ) {
      return null;
    }

    normalized.push(fields);
  }

  return normalized;
}

export async function getHomeHeroSetting(): Promise<HomeHeroSlideSetting[]> {
  const stored = await get<unknown>("homeHero", DEFAULT_HOME_HERO_SLIDES);
  const strict = normalizeHomeHeroSetting(stored);
  if (!strict) return DEFAULT_HOME_HERO_SLIDES;

  const normalized = strict.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const fallback = DEFAULT_HOME_HERO_SLIDES[index] ?? {
      id: `home-slide-${index + 1}`,
      imageUrl: "",
      imageAlt: "首页轮播图片",
      eyebrow: "LQPP / FEATURED",
      title: "一段正在发生的故事",
      description: "",
      href: "/world",
      linkLabel: "继续浏览",
    };

    return [{
      id: stringValue(value.id, fallback.id),
      imageUrl: stringValue(value.imageUrl, fallback.imageUrl),
      imageAlt: stringValue(value.imageAlt, fallback.imageAlt),
      eyebrow: stringValue(value.eyebrow, fallback.eyebrow),
      title: stringValue(value.title, fallback.title),
      description: stringValue(value.description, fallback.description),
      href: stringValue(value.href, fallback.href),
      linkLabel: stringValue(value.linkLabel, fallback.linkLabel),
    }];
  });

  return normalized.length > 0 ? normalized : DEFAULT_HOME_HERO_SLIDES;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key },
    { $set: { key, value, updatedAt: new Date() } },
    { upsert: true }
  );
}
