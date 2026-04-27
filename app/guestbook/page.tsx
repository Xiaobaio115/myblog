import type { Metadata } from "next";
import { SiteFrame } from "@/app/components/site-frame";
import { socials } from "@/data/profile";
import { getDb } from "@/lib/mongodb";
import { GuestbookForm } from "./guestbook-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "留言｜给 LQPP 留句话",
};

async function getMessages() {
  try {
    const db = await getDb();
    const messages = await db
      .collection("guestbook")
      .find({ approved: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return messages.map((m) => ({
      _id: String(m._id),
      name: String(m.name ?? "匿名"),
      website: m.website ? String(m.website) : "",
      message: String(m.message ?? ""),
      createdAt: m.createdAt ? new Date(m.createdAt as Date).toLocaleDateString("zh-CN") : "",
    }));
  } catch {
    return [];
  }
}

export default async function GuestbookPage() {
  const messages = await getMessages();

  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">Guestbook</p>
        <h1 className="hero-title">给我留句话</h1>
        <p className="hero-copy">无论是技术、博客、旅行、游戏，还是一句简单的你好，都欢迎留下。</p>
      </section>

      <section className="container section guestbook-shell">
        <aside className="guestbook-contact">
          <div className="glass-panel">
            <h2>联系我</h2>
            <p className="section-copy">也可以通过以下方式找到我：</p>
            <div className="profile-content-stack">
              {socials.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="guestbook-social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="guestbook-main">
          <div className="glass-panel">
            <h2>留言板</h2>
            <p className="section-copy">留下你的留言，我会认真阅读每一条。</p>
            <GuestbookForm />
          </div>

          {messages.length > 0 && (
            <div className="guestbook-messages">
              <h3 className="section-title">大家说的话</h3>
              <div className="guestbook-list">
                {messages.map((m) => (
                  <div key={m._id} className="guestbook-item">
                    <div className="guestbook-item-header">
                      <strong>
                        {m.website
                          ? <a href={m.website} target="_blank" rel="noopener noreferrer">{m.name}</a>
                          : m.name}
                      </strong>
                      <span>{m.createdAt}</span>
                    </div>
                    <p>{m.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteFrame>
  );
}
