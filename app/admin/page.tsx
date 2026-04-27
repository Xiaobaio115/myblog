import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">DASHBOARD</div>
          <h1>后台总览</h1>
          <p>管理文章、图片、分类和站点内容。</p>
        </div>
      </div>

      <div className="admin-stats-grid">
        <Link href="/admin/posts" className="admin-stat-card">
          <span>📝</span>
          <strong>文章管理</strong>
          <p>发布新文章、维护摘要、标签和封面图。</p>
        </Link>

        <Link href="/admin/photos" className="admin-stat-card">
          <span>📷</span>
          <strong>相册管理</strong>
          <p>按分类上传照片，并同步展示到相册页。</p>
        </Link>

        <Link href="/admin/settings" className="admin-stat-card">
          <span>⚙️</span>
          <strong>站点设置</strong>
          <p>修改个人信息、技能、项目、旅行目的地等内容。</p>
        </Link>

        <Link href="/admin/guestbook" className="admin-stat-card">
          <span>💬</span>
          <strong>留言管理</strong>
          <p>审核留言、查看访客邮箱、IP 和设备信息。</p>
        </Link>

        <Link href="/" className="admin-stat-card">
          <span>🌸</span>
          <strong>站点预览</strong>
          <p>查看首页、文章页和相册页的实际效果。</p>
        </Link>
      </div>

      <section className="admin-tips">
        <h2>建议工作流</h2>
        <ul>
          <li>写文章时，把封面图先上传到相册或 Blob，再复制 URL。</li>
          <li>相册图片一定要选择分类，比如旅行、日常、风景、截图。</li>
          <li>前台相册页会自动根据分类生成筛选按钮。</li>
        </ul>
      </section>
    </main>
  );
}