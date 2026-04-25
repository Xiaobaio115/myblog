export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  getRecentPostVisits,
  getUniqueVisitorCountsBySlugs,
} from "@/lib/content";
import { getDb } from "@/lib/mongodb";
import { PostEditor } from "./post-editor";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminPostEditPage({ params }: PageProps) {
  const { slug } = await params;
  const db = await getDb();
  const [post, recentVisits, uniqueVisitorCounts] = await Promise.all([
    db.collection("posts").findOne({ slug }),
    getRecentPostVisits(slug, 12),
    getUniqueVisitorCountsBySlugs([slug]),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <main className="admin-page">
      <PostEditor
        post={{
          title: String(post.title ?? ""),
          slug: String(post.slug ?? ""),
          excerpt: post.excerpt ? String(post.excerpt) : "",
          content: post.content ? String(post.content) : "",
          coverUrl: post.coverUrl ? String(post.coverUrl) : "",
          tags: Array.isArray(post.tags)
            ? post.tags.map((tag) => String(tag)).filter(Boolean)
            : [],
          date: post.date ? String(post.date) : "",
          views:
            typeof post.views === "number"
              ? post.views
              : Number(post.views ?? 0),
          published: Boolean(post.published),
        }}
        recentVisits={recentVisits}
        uniqueVisitors={uniqueVisitorCounts[slug] || 0}
      />
    </main>
  );
}
