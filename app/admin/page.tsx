import Link from "next/link";

const metrics = [
  { label: "内容模块", value: "6", hint: "文章 / 相册 / 留言 / 地图" },
  { label: "公开工作流", value: "3", hint: "编辑、审核、发布" },
  { label: "快捷入口", value: "8", hint: "侧栏常用操作" },
  { label: "主题模式", value: "3", hint: "浅色 / 深色 / 蓝色" },
];

const tasks = [
  {
    href: "/admin/posts/new",
    title: "发布新文章",
    desc: "进入编辑器，填写标题、摘要、封面和正文。",
    action: "开始写作",
  },
  {
    href: "/admin/photos",
    title: "整理相册",
    desc: "上传图片，确认分类、公开状态和 3D 展示。",
    action: "管理图片",
  },
  {
    href: "/admin/guestbook",
    title: "审核留言",
    desc: "处理待审核内容，删除垃圾留言或发布有效留言。",
    action: "查看留言",
  },
  {
    href: "/admin/settings",
    title: "维护站点资料",
    desc: "更新个人信息、项目、社交链接和首页展示内容。",
    action: "编辑资料",
  },
];

const modules = [
  { name: "文章管理", status: "内容生产", href: "/admin/posts" },
  { name: "相册管理", status: "媒体资产", href: "/admin/photos" },
  { name: "留言审核", status: "访客互动", href: "/admin/guestbook" },
  { name: "旅行地图", status: "世界内容", href: "/admin/travel-map" },
  { name: "站点设置", status: "全局配置", href: "/admin/settings" },
];

export default function AdminPage() {
  return (
    <main className="admin-dashboard admin-console">
      <section className="admin-console-hero">
        <div>
          <div className="admin-badge">OVERVIEW</div>
          <h1>控制台</h1>
          <p>从这里进入日常维护：发布内容、处理留言、整理图片、调整站点展示。</p>
        </div>
        <div className="admin-console-actions">
          <Link href="/admin/posts/new" className="admin-button">
            新建文章
          </Link>
          <Link href="/admin/photos" className="secondary-link">
            上传照片
          </Link>
        </div>
      </section>

      <section className="admin-metric-grid">
        {metrics.map((metric) => (
          <div className="admin-metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.hint}</small>
          </div>
        ))}
      </section>

      <section className="admin-console-grid">
        <div className="admin-console-panel">
          <div className="admin-panel-head">
            <div>
              <h2>快捷任务</h2>
              <p>按照后台最常用的工作顺序组织。</p>
            </div>
          </div>

          <div className="admin-task-list">
            {tasks.map((task) => (
              <Link href={task.href} className="admin-task-row" key={task.href}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.desc}</span>
                </div>
                <em>{task.action}</em>
              </Link>
            ))}
          </div>
        </div>

        <aside className="admin-console-panel">
          <div className="admin-panel-head">
            <div>
              <h2>模块状态</h2>
              <p>快速跳转到对应管理页。</p>
            </div>
          </div>

          <div className="admin-module-list">
            {modules.map((module) => (
              <Link href={module.href} key={module.href}>
                <span>{module.name}</span>
                <small>{module.status}</small>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
