import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getProjectsSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "项目｜LQPP 正在做的东西",
};

export default async function ProjectsPage() {
  const projects = await getProjectsSetting();
  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">Projects</p>
        <h1 className="hero-title">我正在做的东西</h1>
        <p className="hero-copy">这里记录本站、技术练习、未来想探索的作品和长期建设计划。</p>
      </section>

      <section className="container section">
        <div className="project-showcase-grid">
          {projects.map((project) => (
            <Link key={project.title} href={project.href} className="project-card">
              <span className="project-status">{project.status}</span>
              <h2>{project.title}</h2>
              <p>{project.desc}</p>
              <div className="world-tag-row">
                {project.stack.map((item) => <span key={item}>{item}</span>)}
              </div>
              <strong>查看详情 →</strong>
            </Link>
          ))}
        </div>
      </section>
    </SiteFrame>
  );
}
