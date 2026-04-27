/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getEducationSetting, getProfileSetting, getWorldSectionsSetting } from "@/lib/settings";
import { getPublishedPosts, getLatestPhotos } from "@/lib/content";
import { WorldSectionPhotoClient } from "@/app/world/world-section-photo-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的学校｜LQPP World" };

export default async function SchoolPage() {
  const [education, profile, posts, photosAll, sections] = await Promise.all([
    getEducationSetting(),
    getProfileSetting(),
    getPublishedPosts(100),
    getLatestPhotos(200),
    getWorldSectionsSetting(),
  ]);
  const section = sections.find((s) => s.id === "school") ?? sections[1];
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
            {profile.location && (
              <p className="sidebar-profile-location">📍 {profile.location}</p>
            )}
            <Link href="/about" className="sidebar-profile-link">查看完整档案 →</Link>
          </div>

          <div className="world-sub-nav-item active">{section.title}</div>
        </aside>

        <main className="world-sub-main">
          <div className="world-sub-detail">
            <WorldSectionPhotoClient section={section} />

            {education.length > 0 && (
              <div className="glass-panel" style={{ marginTop: 24 }}>
                <h2>教育经历</h2>
                <div className="profile-timeline">
                  {education.map((item) => (
                    <div key={item.time} className="timeline-item">
                      <span className="timeline-time">{item.time}</span>
                      <strong>{item.title}</strong>
                      <p>{item.desc}</p>
                      <div className="world-tag-row">
                        {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </SiteFrame>
  );
}
