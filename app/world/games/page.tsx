import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getGamesSetting, getProfileSetting } from "@/lib/settings";
import { getPublishedPosts, getLatestPhotos } from "@/lib/content";
import { GamesClient } from "./games-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "游戏世界｜LQPP World" };

export default async function GamesPage() {
  const [games, profile, posts, photos] = await Promise.all([
    getGamesSetting(),
    getProfileSetting(),
    getPublishedPosts(100),
    getLatestPhotos(999),
  ]);
  return (
    <SiteFrame>
      <div className="world-sub-breadcrumb container">
        <Link href="/world">我的世界</Link>
        <span>›</span>
        <span>游戏世界</span>
      </div>
      <GamesClient
        games={games}
        profile={profile}
        postCount={posts.length}
        photoCount={photos.length}
      />
    </SiteFrame>
  );
}
