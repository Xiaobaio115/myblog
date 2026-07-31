import type { Metadata } from "next";
import { PoeticPageHero } from "@/app/components/poetic-page-hero";
import { SiteFrame } from "@/app/components/site-frame";
import { getDb } from "@/lib/mongodb";
import { getSocialsSetting } from "@/lib/settings";
import { GuestbookForm } from "./guestbook-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "留言 | 给 LQPP 留句话",
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

    return messages.map((message) => ({
      _id: String(message._id),
      name: String(message.name ?? "匿名"),
      website: message.website ? String(message.website) : "",
      message: String(message.message ?? ""),
      createdAt: message.createdAt
        ? new Date(message.createdAt as Date).toLocaleDateString("zh-CN")
        : "",
    }));
  } catch {
    return [];
  }
}

export default async function GuestbookPage() {
  const [messages, socials] = await Promise.all([getMessages(), getSocialsSetting()]);

  return (
    <SiteFrame>
      <PoeticPageHero
        eyebrow="Open Letters / 留言"
        title="留一句话，让相遇有迹可循"
        description="写下你的名字与想说的话；审核通过后，它会留在这面留言墙上。"
        background="photos"
      />

      <section className="container pink-guestbook-shell">
        <aside className="pink-panel">
          <h2>联系我</h2>
          <p>也可以通过以下方式找到我：</p>
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
        </aside>

        <div className="pink-about-stack">
          <div className="pink-panel">
            <h2>留言板</h2>
            <p>留言提交后会进入审核，通过后展示在这里。欢迎一句简单的你好。</p>
            <GuestbookForm />
          </div>

          <div className="guestbook-messages">
            <div className="pink-section-head compact" style={{ textAlign: "left", margin: "8px 0 18px" }}>
              <h2 style={{ fontSize: "1.35rem" }}>大家说的话</h2>
              <p>审核通过后会出现在这里。</p>
            </div>
            {messages.length > 0 ? (
              <div className="guestbook-list">
                {messages.map((item) => (
                  <div key={item._id} className="guestbook-item">
                    <div className="guestbook-item-header">
                      <strong>
                        {item.website ? (
                          <a href={item.website} target="_blank" rel="noopener noreferrer">
                            {item.name}
                          </a>
                        ) : (
                          item.name
                        )}
                      </strong>
                      <span>{item.createdAt}</span>
                    </div>
                    <p>{item.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state-rich">
                <div className="empty-icon">✉</div>
                <h3>还没有公开留言</h3>
                <p>等第一条审核通过后会显示在这里。你也可以先从侧边栏找到我。</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
