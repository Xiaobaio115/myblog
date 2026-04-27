/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getProfileSetting, getWorldSectionsSetting } from "@/lib/settings";
import { getPublishedPosts, getLatestPhotos } from "@/lib/content";
import { WorldSectionPhotoClient } from "@/app/world/world-section-photo-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的家乡｜LQPP World" };

type Props = { searchParams: Promise<{ tag?: string }> };

export default async function HometownPage({ searchParams }: Props) {
  const { tag: initialTag } = await searchParams;
  const [profile, posts, photosAll, sections] = await Promise.all([
    getProfileSetting(),
    getPublishedPosts(100),
    getLatestPhotos(999),
    getWorldSectionsSetting(),
  ]);
  const section = sections.find((s) => s.id === "hometown") ?? sections[0];
  if (!section) return null;

  return (
    <SiteFrame>
      <div className="world-sub-breadcrumb container">
        <Link href="/world">我的世界</Link>
        <span>›</span>
        <span>{section.title}</span>
      </div>

      <div className="world-sub-shell container">
        <aside className="world-sub-sidebar">
          <div className="sidebar-profile-card">
            <div className="sidebar-profile-avatar">
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.name} />
                : <span>{profile.name.slice(0, 2)}</span>}
            </div>
            <strong className="sidebar-profile-name">{profile.name}</strong>
            <span className="sidebar-profile-tagline">{profile.tagline}</span>
            <div className="sidebar-profile-stats">
              <div><strong>{posts.length}</strong><span>文章</span></div>
              <div><strong>{photosAll.length}</strong><span>照片</span></div>
            </div>
            {profile.location && <p className="sidebar-profile-location">📍 {profile.location}</p>}
            <Link href="/about" className="sidebar-profile-link">查看完整档案 →</Link>
          </div>
          <div className="world-sub-nav-item active">{section.title}</div>
          {section.tags.length > 0 && (
            <div className="world-sub-nav-info">
              {section.tags.map((tag) => (
                <Link
                  key={tag}
                  href={initialTag === tag ? "/world/hometown" : `?tag=${tag}`}
                  className={`world-sub-info-row${initialTag === tag ? " active" : ""}`}
                >
                  <strong>{tag}</strong>
                </Link>
              ))}
            </div>
          )}
        </aside>

        <main className="world-sub-main">
          <WorldSectionPhotoClient section={section} initialTag={initialTag} />
        </main>
      </div>
    </SiteFrame>
  );
}
