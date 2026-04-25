import { getDb } from "@/lib/mongodb";
import { notFound } from "next/navigation";
import { marked } from "marked";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const db = await getDb();

  const post = await db.collection("posts").findOne({
    slug,
    published: true,
  });

  if (!post) {
    notFound();
  }

  await db.collection("posts").updateOne(
    { slug },
    {
      $inc: { views: 1 },
    }
  );

  const html = marked(post.content || "");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <a href="/" className="text-sm text-gray-500">
        ← 返回首页
      </a>

      <article className="mt-8">
        <div className="mb-3 text-sm text-pink-500">
          {post.tags?.join(" / ")}
        </div>

        <h1 className="text-4xl font-bold">{post.title}</h1>

        <div className="mt-4 text-sm text-gray-400">
           {post.views || 0} 次阅读
        </div>

        {post.coverUrl && (
          <img
            src={post.coverUrl}
            alt={post.title}
            className="my-8 w-full rounded-2xl object-cover"
          />
        )}

        <div
          className="prose prose-pink mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      <section className="mt-12 border-t pt-8">
        <h2 className="mb-4 text-xl font-bold">评论区</h2>
        <div id="twikoo"></div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              twikoo.init({
                envId: "${process.env.TWIKOO_ENV_ID}",
                el: "#twikoo",
                path: "/posts/${slug}",
                lang: "zh-CN"
              })
            `,
          }}
        />
      </section>
    </main>
  );
}
