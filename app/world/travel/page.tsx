import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getTravelSetting, getProfileSetting } from "@/lib/settings";
import { getPublishedPosts, getLatestPhotos } from "@/lib/content";
import { TravelClient } from "./travel-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "旅行探索｜LQPP World" };

export default async function TravelPage() {
  const [destinations, profile, posts, photos] = await Promise.all([
    getTravelSetting(),
    getProfileSetting(),
    getPublishedPosts(100),
    getLatestPhotos(999),
  ]);
  return (
    <SiteFrame>
      <div className="world-sub-breadcrumb container">
        <Link href="/world">我的世界</Link>
        <span>›</span>
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
