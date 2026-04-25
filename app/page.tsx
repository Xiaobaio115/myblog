import Link from "next/link";
import { getDb } from "@/lib/mongodb";

export default async function HomePage() {
    return (
    <main>
      <h1>我的博客</h1>
    </main>
  );
  const db = await getDb();

  const posts = await db
    .collection("posts")
    .find({ published: true })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <section className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-pink-100 text-4xl">
          
        </div>
        <h1 className="text-4xl font-bold">我的小宇宙博客</h1>
        <p className="mt-3 text-gray-500">
          记录生活、技术、旅行和一些小小的灵感。
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {posts.map((post: any) => (
          <Link
            key={post.slug}
            href={`/posts/${post.slug}`}
            className="rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            {post.coverUrl && (
              <img
                src={post.coverUrl}
                alt={post.title}
                className="mb-4 h-48 w-full rounded-xl object-cover"
              />
            )}

            <div className="mb-2 text-sm text-pink-500">
              {post.tags?.join(" / ")}
            </div>

            <h2 className="text-xl font-bold">{post.title}</h2>

            <p className="mt-2 text-sm text-gray-500">{post.excerpt}</p>

            <div className="mt-4 text-sm text-gray-400">
               {post.views || 0}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
