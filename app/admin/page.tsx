import Link from "next/link";
import styles from "./dashboard.module.css";

const workflows = [
  { code: "WRITE", href: "/admin/posts/new", title: "发布文章", desc: "编辑标题、摘要、封面与 Markdown 正文。" },
  { code: "MEDIA", href: "/admin/photos", title: "整理相册", desc: "上传图片，设置分类、可见性与 3D 展示。" },
  { code: "REVIEW", href: "/admin/guestbook", title: "审核留言", desc: "处理待审核内容与访客互动。" },
];
const tasks = [
  { href: "/admin/posts", title: "管理已有文章", desc: "编辑、预览或删除已发布内容。", action: "文章列表" },
  { href: "/admin/travel-map", title: "更新旅行地图", desc: "维护省份、城市、坐标与相关照片。", action: "编辑地图" },
  { href: "/admin/chat-notifications", title: "检查 AI 与通知", desc: "验证模型连接、Server酱和 Webhook 设置。", action: "打开配置" },
  { href: "/admin/settings", title: "维护站点资料", desc: "更新个人信息、项目、社交链接与首页内容。", action: "站点设置" },
];
const modules = [
  { name: "文章", status: "内容生产", href: "/admin/posts" },
  { name: "相册", status: "媒体资产", href: "/admin/photos" },
  { name: "留言", status: "访客互动", href: "/admin/guestbook" },
  { name: "旅行地图", status: "地点档案", href: "/admin/travel-map" },
  { name: "AI 与通知", status: "连接与转发", href: "/admin/chat-notifications" },
  { name: "站点设置", status: "全局配置", href: "/admin/settings" },
];

export default function AdminPage() {
  return (
    <main className={styles.dashboard}>
      <header className={styles.heading}>
        <div><div className={styles.eyebrow}>OVERVIEW</div><h1>内容工作台</h1><p>从最常用的任务开始，其他模块在下方集中管理。</p></div>
        <div className={styles.actions}><Link href="/admin/posts/new" className="admin-button">新建文章</Link><Link href="/admin/photos" className="secondary-link">上传照片</Link></div>
      </header>
      <section className={styles.workflow} aria-label="主要工作流">
        {workflows.map((item) => <Link href={item.href} key={item.href}><small>{item.code}</small><em>↗</em><strong>{item.title}</strong><span>{item.desc}</span></Link>)}
      </section>
      <section className={styles.workspace}>
        <div><div className={styles.sectionHead}><h2>维护任务</h2><p>按内容维护顺序组织。</p></div><div className={styles.taskList}>
          {tasks.map((task) => <Link href={task.href} className={styles.task} key={task.href}><div><strong>{task.title}</strong><span>{task.desc}</span></div><em>{task.action}</em></Link>)}
        </div></div>
        <aside><div className={styles.sectionHead}><h2>全部模块</h2><p>快速进入对应管理页。</p></div><div className={styles.moduleList}>
          {modules.map((module) => <Link href={module.href} className={styles.module} key={module.href}><span>{module.name}</span><small>{module.status}</small></Link>)}
        </div></aside>
      </section>
    </main>
  );
}
