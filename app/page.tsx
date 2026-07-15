/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArticleCard } from "@/app/components/article-card";
import { HomePhotoItem } from "@/app/components/home-photo-item";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos, getPublishedPosts } from "@/lib/content";
import { getProfileSetting, getSkillsSetting } from "@/lib/settings";

export default async function HomePage() {
  const [posts, photos, profile, skills] = await Promise.all([
    getPublishedPosts(100),
    getLatestPhotos(48),
    getProfileSetting(),
    getSkillsSetting(),
  ]);

  const latestPosts = posts.slice(0, 4);
  const featuredPhotos = photos.slice(0, 8);
  const displayName = profile.name || "LQPP";

  const stats = [
    { label: "文章", value: posts.length },
    { label: "照片", value: photos.length },
    { label: "板块", value: 6 },
  ];

  const featuredSkills = skills
    .flatMap((group) =>
      group.items.map((item) =>
        typeof item === "string"
          ? { name: item, iconUrl: undefined, group: group.group }
          : { name: item.name, iconUrl: item.iconUrl, group: group.group },
      ),
    )
    .slice(0, 10);

  return (
    <SiteFrame>
      <section className="pink-home-hero container">
        <div className="pink-home-copy">
          <p className="eyebrow">Personal Digital Garden</p>
          <h1>Hi，我是 {displayName}</h1>
          <p className="pink-home-status">{profile.status}</p>
          <p className="pink-home-intro">{profile.intro}</p>
          <div className="pink-home-actions">
            <Link href="/world" className="pink-btn primary">
              探索我的世界
            </Link>
            <Link href="/articles" className="pink-btn">
              查看文章
            </Link>
            <Link href="/photos/3d" className="pink-btn">
              进入星空相册
            </Link>
          </div>
        </div>

        <div className="pink-home-profile-bar">
          <div className="avatar">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={displayName} />
            ) : (
              <span>LQ</span>
            )}
          </div>
          <div className="info">
            <span className="name">{displayName}</span>
            {profile.tagline ? <span className="tagline">{profile.tagline}</span> : null}
          </div>
          <div className="divider" aria-hidden="true" />
          <div className="stats">
            {stats.map((item) => (
              <span key={item.label}>
                <strong>{item.value}</strong> {item.label}
              </span>
            ))}
          </div>
          <div className="divider" aria-hidden="true" />
          <div className="meta-links">
            {profile.githubUrl ? (
              <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            ) : null}
            <Link href="/about">查看完整档案</Link>
          </div>
        </div>
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>从这里开始探索</h2>
          <p>文章、旅行地图、相册和 3D 星空墙，都是这个数字花园的一部分。</p>
        </div>

        <div className="pink-module-grid pink-module-grid-4">
          <Link href="/world" className="pink-module">
            <span className="pink-module-kicker">World Map</span>
            <h3>我的世界</h3>
            <p>家乡、学校、旅行、游戏，一整张个人世界地图。</p>
            <span className="pink-text-link">打开地图</span>
          </Link>

          <Link href="/articles" className="pink-module">
            <span className="pink-module-kicker">Articles</span>
            <h3>思考碎片</h3>
            <p>技术笔记、生活随笔，以及突然冒出来的想法。</p>
            <span className="pink-text-link">查看全部</span>
          </Link>

          <Link href="/photos" className="pink-module pink-module-dark">
            <span className="pink-module-kicker">Memory Atlas</span>
            <h3>记忆星图</h3>
            <p>普通相册、3D 星空墙与旅行地图，翻翻记忆。</p>
            <span className="pink-text-link">进入相册</span>
          </Link>

          <Link href="/about" className="pink-module">
            <span className="pink-module-kicker">Profile</span>
            <h3>关于我</h3>
            <p>个人档案、教育经历、技术栈与联系方式。</p>
            <span className="pink-text-link">了解 {displayName}</span>
          </Link>
        </div>
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>当前状态</h2>
          <p>正在做什么、在哪儿、以及最近在琢磨的事。</p>
        </div>
        <div className="pink-now-grid">
          <div className="pink-now-card pink-now-card-primary">
            <span className="pink-now-kicker">Now</span>
            <h3>{profile.status || "在做点小事"}</h3>
            {profile.location ? (
              <p>
                <span className="pink-now-badge">◎</span> {profile.location}
              </p>
            ) : null}
            {profile.intro ? <p className="pink-now-intro">{profile.intro}</p> : null}
          </div>

          <div className="pink-now-card">
            <span className="pink-now-kicker">Latest</span>
            <h3>最近的想法</h3>
            {latestPosts[0] ? (
              <Link href={`/posts/${latestPosts[0].slug}`} className="pink-now-post">
                <span className="pink-now-post-title">{latestPosts[0].title}</span>
                {latestPosts[0].excerpt ? (
                  <span className="pink-now-post-excerpt">{latestPosts[0].excerpt}</span>
                ) : null}
              </Link>
            ) : (
              <p>还没有写下最新的想法，很快会有。</p>
            )}
          </div>

          <div className="pink-now-card">
            <span className="pink-now-kicker">Identity</span>
            <h3>身份关键词</h3>
            <div className="pink-now-tags">
              {(profile.tags && profile.tags.length > 0
                ? profile.tags
                : ["学生", "博客作者", "旅行探索者"]
              ).map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>我的工具箱</h2>
          <p>正在用、正在学、想继续探索的技术，一份轻量预览。</p>
        </div>
        {featuredSkills.length > 0 ? (
          <>
            <div className="pink-skill-preview">
              {featuredSkills.map((skill) => (
                <span key={skill.name} className="pink-skill-chip">
                  {skill.iconUrl ? (
                    <img src={skill.iconUrl} alt="" width={18} height={18} loading="lazy" />
                  ) : (
                    <span className="pink-skill-dot" aria-hidden="true" />
                  )}
                  {skill.name}
                </span>
              ))}
            </div>
            <div className="pink-skill-more">
              <Link href="/about#skills" className="pink-text-link">
                查看完整技术栈 →
              </Link>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>技术栈还在整理中。</p>
          </div>
        )}
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>最新文章</h2>
          <p>最近写下的想法与记录，持续更新中。</p>
        </div>
        {latestPosts.length > 0 ? (
          <div className="cards-grid">
            {latestPosts.map((post) => (
              <ArticleCard key={post._id} post={post} />
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state-rich">
            <div className="empty-icon">✎</div>
            <h3>还没有发布文章</h3>
            <p>第一篇思考碎片很快就会出现。也可以先去我的世界逛逛。</p>
            <div className="empty-actions">
              <Link href="/world" className="pink-btn primary">
                先去看看我的世界
              </Link>
              <Link href="/articles" className="pink-btn">
                查看文章页
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="container pink-section">
        <div className="pink-section-head">
          <h2>精选相册</h2>
          <p>截取一些值得留下的瞬间。</p>
        </div>
        {featuredPhotos.length > 0 ? (
          <div className="home-photo-grid pink-photo-grid">
            {featuredPhotos.map((photo) => (
              <HomePhotoItem
                key={photo._id}
                url={photo.url ?? ""}
                caption={photo.caption || "精选瞬间"}
              />
            ))}
          </div>
        ) : (
          <div className="home-photo-placeholder">
            <Link href="/photos/3d" className="pink-btn primary">
              打开 3D 星空相册
            </Link>
            <Link href="/photos" className="pink-btn">
              查看全部照片
            </Link>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}
