import type { Metadata } from "next";
import Link from "next/link";
import { PoeticPageHero } from "@/app/components/poetic-page-hero";
import { SiteFrame } from "@/app/components/site-frame";
import { getProfileSetting, getTravelSetting } from "@/lib/settings";
import { getLatestPhotos, getPublishedPosts } from "@/lib/content";
import { TravelClient } from "./travel-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "旅行探索 | LQPP World" };

export default async function TravelPage() {
  const [destinations, profile, posts, photos] = await Promise.all([
    getTravelSetting(),
    getProfileSetting(),
    getPublishedPosts(100),
    getLatestPhotos(999),
  ]);

  return (
    <SiteFrame>
      <PoeticPageHero
        eyebrow="行旅 · JOURNEY"
        title="去远方，也去遇见自己"
        description="把走过的山河，收进一页页正在生长的地图。"
        background="travel"
      >
        <Link href="/world/travel-map" className="pink-btn primary">
          打开旅行地图
        </Link>
      </PoeticPageHero>

      <div className="world-sub-breadcrumb container">
        <Link href="/world">我的世界</Link>
        <span>/</span>
        <span>旅行探索</span>
      </div>
      <TravelClient
        destinations={destinations}
        profile={profile}
        postCount={posts.length}
        photoCount={photos.length}
      />
    </SiteFrame>
  );
}
