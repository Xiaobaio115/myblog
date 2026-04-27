/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getEducationSetting, getProfileSetting, getWorldSectionsSetting } from "@/lib/settings";
import { getPublishedPosts, getLatestPhotos } from "@/lib/content";
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
          {/* 封面 + 简介 */}
          <div className="world-sub-detail">
            <div className="world-sub-detail-header">
              <div>
                <h1>{section.title}</h1>
                <p className="world-sub-type">{section.eyebrow}</p>
              </div>
            </div>

            {section.cover && (
              <div className="world-sub-cover">
                <img src={section.cover} alt={section.title} />
              </div>
            )}

            {section.desc && <p className="world-sub-desc">{section.desc}</p>}

            {section.tags.length > 0 && (
              <div className="world-tag-row">
                {section.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
          </div>

          {/* 教育时间轴 */}
          {education.length > 0 && (
            <div className="edu-timeline-section">
              <div className="edu-timeline-heading">
                <h2>教育背景</h2>
                <span className="edu-timeline-en">EDUCATION</span>
              </div>
              <div className="edu-timeline">
                {education.map((item, idx) => (
                  <div key={idx} className="edu-timeline-card">
                    <div className="edu-timeline-dot" />
                    <div className="edu-timeline-body">
                      <span className="edu-timeline-time">{item.time}</span>
                      <h3 className="edu-timeline-title">{item.title}</h3>
                      {item.desc && <p className="edu-timeline-desc">{item.desc}</p>}
                      {item.tags.length > 0 && (
                        <div className="world-tag-row" style={{ justifyContent: "flex-start" }}>
                          {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </SiteFrame>
  );
}
