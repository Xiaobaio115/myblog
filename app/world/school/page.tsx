/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { schoolContent } from "@/data/world";
import { getEducationSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的学校｜LQPP World" };

export default async function SchoolPage() {
  const education = await getEducationSetting();
  const { title, subtitle, desc, details, photos } = schoolContent;

  return (
    <SiteFrame>
      <div className="world-sub-breadcrumb container">
        <Link href="/world">我的世界</Link>
        <span>›</span>
        <span>{title}</span>
      </div>

      <div className="world-sub-shell container">
        <aside className="world-sub-sidebar">
          <div className="world-sub-nav-item active">{title}</div>
          <div className="world-sub-nav-info">
            {details.map((d) => (
              <div key={d.label} className="world-sub-info-row">
                <span>{d.label}</span>
                <strong>{d.value}</strong>
              </div>
            ))}
          </div>
        </aside>

        <main className="world-sub-main">
          <div className="world-sub-detail">
            <div className="world-sub-detail-header">
              <div>
                <h1>{title}</h1>
                <p className="world-sub-type">{subtitle}</p>
              </div>
            </div>

            <div className="world-sub-cover">
              <span className="world-sub-cover-placeholder">🏫 封面图待上传</span>
            </div>

            <p className="world-sub-desc">{desc}</p>

            <div className="glass-panel">
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

            {photos.length > 0 ? (
              <div className="world-sub-photo-grid">
                {photos.map((url, i) => (
                  <img key={i} src={url} alt={`学校 ${i + 1}`} />
                ))}
              </div>
            ) : (
              <div className="world-sub-photo-placeholder">
                <p>照片待上传，可在 <Link href="/admin/photos">后台相册</Link> 添加</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </SiteFrame>
  );
}
