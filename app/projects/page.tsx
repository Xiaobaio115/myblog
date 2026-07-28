import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getProjectsSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "项目 | LQPP 正在做的东西",
};

export default async function ProjectsPage() {
  const projects = await getProjectsSetting();
  const liveCount = projects.filter((project) =>
    /上线|进行|完成/.test(project.status)
  ).length;

  return (
    <SiteFrame>
      <section className="container projects-hero">
        <div className="projects-hero-copy">
          <p className="eyebrow">Selected Works · {new Date().getFullYear()}</p>
          <h1>
            把好奇心，做成
            <span>可以被打开的作品。</span>
          </h1>
          <p>
            从个人网站、沉浸式照片墙到旅行地图，这里收集正在生长的想法、技术实验和生活切片。
          </p>
        </div>
        <div className="projects-hero-stats" aria-label="项目概览">
          <div>
            <strong>{String(projects.length).padStart(2, "0")}</strong>
            <span>收录项目</span>
          </div>
          <div>
            <strong>{String(liveCount).padStart(2, "0")}</strong>
            <span>已经可体验</span>
          </div>
        </div>
      </section>

      <section className="container projects-section">
        <div className="projects-section-heading">
          <div>
            <span>WORK INDEX</span>
            <h2>持续更新中的创作档案</h2>
          </div>
          <p>每一个项目，都是技术能力和个人表达的一次相遇。</p>
        </div>

        <div className="project-showcase-grid projects-showcase">
          {projects.map((project, index) => (
            <Link key={project.title} href={project.href} className="project-card project-art-card">
              <div className="project-card-topline">
                <span className="project-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="project-status">
                  <i aria-hidden="true" />
                  {project.status}
                </span>
              </div>
              <div className="project-card-copy">
                <h2>{project.title}</h2>
                <p>{project.desc}</p>
              </div>
              <div className="world-tag-row project-stack-row">
                {project.stack.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="project-card-link">
                <strong>打开项目</strong>
                <span aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </SiteFrame>
  );
}
