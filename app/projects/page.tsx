import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getProjectsSetting, type ProjectItem } from "@/lib/settings";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "项目 | LQPP 正在做的东西",
};

const PROJECT_VISUALS = {
  home: {
    src: "/project-previews/home.webp",
    alt: "LQPP World 首页界面",
  },
  photos: {
    src: "/project-previews/photo-wall.webp",
    alt: "3D 星空照片墙界面",
  },
  world: {
    src: "/project-previews/world.webp",
    alt: "LQPP World 世界页面",
  },
} as const;

function getProjectVisual(project: ProjectItem) {
  const fingerprint = `${project.title} ${project.href}`.toLowerCase();
  if (/星空|相册|photo|3d/.test(fingerprint)) return PROJECT_VISUALS.photos;
  if (/旅行|地图|world|待办|学习/.test(fingerprint)) return PROJECT_VISUALS.world;
  return PROJECT_VISUALS.home;
}

export default async function ProjectsPage() {
  const projects = await getProjectsSetting();
  const liveCount = projects.filter((project) =>
    /上线|进行|完成/.test(project.status),
  ).length;

  return (
    <SiteFrame>
      <section className={styles.hero}>
        <Image
          className={styles.heroImage}
          src="/project-previews/photo-wall.webp"
          alt="LQPP 3D 星空照片墙"
          fill
          sizes="100vw"
          preload
        />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <p className={styles.kicker}>LQPP PROJECTS · {new Date().getFullYear()}</p>
          <h1>把想法做成可以打开的作品</h1>
          <p className={styles.heroCopy}>
            个人网站、沉浸式照片墙和旅行地图，记录每一次技术实验与生活表达。
          </p>
          <a href="#project-index" className={styles.heroLink}>
            浏览项目
            <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className={styles.heroMeta} aria-label="项目概览">
          <span>{String(projects.length).padStart(2, "0")} 收录</span>
          <span>{String(liveCount).padStart(2, "0")} 可体验</span>
        </div>
      </section>

      <section id="project-index" className={styles.indexSection}>
        <header className={styles.sectionHead}>
          <div>
            <span>WORK INDEX</span>
            <h2>持续更新中的创作档案</h2>
          </div>
          <p>从真实页面进入每个项目。</p>
        </header>

        <div className={styles.projectGrid}>
          {projects.map((project, index) => {
            const visual = getProjectVisual(project);
            return (
              <Link
                key={`${project.title}-${index}`}
                href={project.href}
                className={styles.project}
              >
                <div className={styles.projectImage}>
                  <Image
                    src={visual.src}
                    alt={visual.alt}
                    fill
                    sizes="(max-width: 760px) 100vw, 50vw"
                  />
                  <span className={styles.openIcon} aria-hidden="true">↗</span>
                </div>
                <div className={styles.projectMeta}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.status}>{project.status}</span>
                </div>
                <h3>{project.title}</h3>
                <p>{project.desc}</p>
                <div className={styles.stack}>
                  {project.stack.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </SiteFrame>
  );
}
