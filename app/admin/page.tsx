import type { CSSProperties } from "react";
import Link from "next/link";
import {
  getPublishedPosts,
  getStoredPhotos,
  getTopPostsByTraffic,
  getTrafficOverview,
} from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [posts, photos, traffic, topPosts] = await Promise.all([
    getPublishedPosts(100),
    getStoredPhotos(100),
    getTrafficOverview(7),
    getTopPostsByTraffic(5),
  ]);

  const publishedCount = posts.filter((post) => post.published !== false).length;
  const recentPosts = posts.slice(0, 4);
  const recentPhotos = photos.slice(0, 4);
  const maxDailyValue = Math.max(
    1,
    ...traffic.daily.flatMap((point) => [point.pv, point.uv])
  );

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="dash-header">
          <div>
            <div className="admin-kicker">Dashboard</div>
            <h1 className="section-title">后台总览</h1>
            <p className="section-copy">
              从这里进入文章管理、发布内容，并查看最近 7 天的访问走势。
            </p>
          </div>
        </div>

        <div className="dash-stats">
          <div className="dash-stat">
            <strong>{posts.length}</strong>
            <span>文章总数</span>
          </div>
          <div className="dash-stat dash-stat-accent">
            <strong>{publishedCount}</strong>
            <span>已发布</span>
          </div>
          <div className="dash-stat">
            <strong>{photos.length}</strong>
            <span>相册图片</span>
          </div>
          <div className="dash-stat">
            <strong>{traffic.totalPv}</strong>
            <span>累计 PV</span>
          </div>
          <div className="dash-stat">
            <strong>{traffic.totalUv}</strong>
            <span>累计 UV</span>
          </div>
        </div>

        <p className="dash-section-label">流量概览</p>
        <div className="traffic-grid">
          <div className="traffic-summary-card">
            <div className="traffic-summary-row">
              <div>
                <p className="traffic-eyebrow">最近 7 天</p>
                <strong>{traffic.recentPv}</strong>
                <span>页面浏览 PV</span>
              </div>
              <div>
                <p className="traffic-eyebrow">最近 7 天</p>
                <strong>{traffic.recentUv}</strong>
                <span>独立访客 UV</span>
              </div>
            </div>
            <p className="traffic-summary-note">
              UV 按 `IP + User-Agent` 去重，PV 为真实打开文章后的累计记录。
            </p>
          </div>

          <div className="traffic-chart-card">
            <div className="dash-recent-header">
              <strong>最近 7 天趋势</strong>
              <span className="traffic-legend">
                <span className="traffic-legend-item">
                  <i className="traffic-dot traffic-dot-pv" />
                  PV
                </span>
                <span className="traffic-legend-item">
                  <i className="traffic-dot traffic-dot-uv" />
                  UV
                </span>
              </span>
            </div>

            <div className="traffic-chart">
              {traffic.daily.map((point) => {
                const pvHeight = `${(point.pv / maxDailyValue) * 100}%`;
                const uvHeight = `${(point.uv / maxDailyValue) * 100}%`;
                const style = {
                  "--pv-height": pvHeight,
                  "--uv-height": uvHeight,
                } as CSSProperties;

                return (
                  <div key={point.key} className="traffic-bar-group" style={style}>
                    <div className="traffic-bar-stack">
                      <span className="traffic-bar traffic-bar-pv" title={`PV ${point.pv}`} />
                      <span className="traffic-bar traffic-bar-uv" title={`UV ${point.uv}`} />
                    </div>
                    <span className="traffic-axis-label">{point.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p className="dash-section-label">快捷操作</p>
        <div className="admin-card-grid">
          <Link href="/admin/posts/new" className="admin-card-link action-card">
            <span className="action-icon">✍</span>
            <strong>发布新文章</strong>
            <span>新建一篇文章并直接发布到站点。</span>
          </Link>
          <Link href="/admin/posts" className="admin-card-link action-card">
            <span className="action-icon">🗂</span>
            <strong>管理文章</strong>
            <span>查看文章列表、最近访问来源，以及每篇文章的 UV / PV。</span>
          </Link>
          <Link href="/admin/photos" className="admin-card-link action-card">
            <span className="action-icon">📷</span>
            <strong>管理相册</strong>
            <span>上传、分类和删除相册中的图片。</span>
          </Link>
          <Link href="/articles" className="admin-card-link action-card">
            <span className="action-icon">📚</span>
            <strong>查看文章列表</strong>
            <span>打开前台文章页，确认发布效果和真实访问情况。</span>
          </Link>
        </div>

        <p className="dash-section-label">最近内容</p>
        <div className="admin-card-grid">
          <div className="dash-recent-box">
            <div className="dash-recent-header">
              <strong>最近文章</strong>
              <Link href="/admin/posts" className="dash-more-link">
                管理 →
              </Link>
            </div>

            {recentPosts.length > 0 ? (
              <div className="dash-recent-list">
                {recentPosts.map((post) => (
                  <div key={post._id} className="dash-recent-item">
                    <span className="dash-recent-dot" />
                    <div>
                      <p className="dash-recent-title">{post.title}</p>
                      <p className="dash-recent-meta">{post.date || "刚刚发布"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="section-copy">还没有文章。</p>
            )}
          </div>

          <div className="dash-recent-box">
            <div className="dash-recent-header">
              <strong>最近照片</strong>
              <Link href="/admin/photos" className="dash-more-link">
                管理 →
              </Link>
            </div>

            {recentPhotos.length > 0 ? (
              <div className="dash-recent-list">
                {recentPhotos.map((photo) => (
                  <div key={photo._id} className="dash-recent-item">
                    <span className="dash-recent-dot" />
                    <div>
                      <p className="dash-recent-title">{photo.caption}</p>
                      <p className="dash-recent-meta">
                        {photo.category || photo.date || "刚刚上传"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="section-copy">还没有照片。</p>
            )}
          </div>

          <div className="dash-recent-box">
            <div className="dash-recent-header">
              <strong>热门文章 Top 5</strong>
              <Link href="/admin/posts" className="dash-more-link">
                查看更多 →
              </Link>
            </div>

            {topPosts.length > 0 ? (
              <div className="dash-recent-list">
                {topPosts.map((post, index) => (
                  <div key={post._id} className="dash-recent-item dash-rank-item">
                    <span className="dash-rank-badge">#{index + 1}</span>
                    <div className="dash-rank-main">
                      <p className="dash-recent-title">{post.title}</p>
                      <p className="dash-recent-meta">
                        PV {post.views} · UV {post.uv}
                        {post.date ? ` · ${post.date}` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/admin/posts/${post.slug}`}
                      className="dash-rank-link"
                    >
                      编辑
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="section-copy">还没有足够的访问数据。</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
