import { getDb } from "@/lib/mongodb";

export type Post = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverUrl?: string;
  tags?: string[];
  date?: string;
  views?: number;
  published?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type Photo = {
  _id: string;
  url?: string;
  caption: string;
  date: string;
  emoji?: string;
  sourceHref?: string;
  category?: string;
};

type RawDocument = Record<string, unknown> & {
  _id?: { toString(): string } | string;
};

const FALLBACK_PHOTOS: Photo[] = [
  {
    _id: "fallback-1",
    caption: "凌晨整理博客时的桌面",
    date: "氛围收藏",
    emoji: "☕",
  },
  {
    _id: "fallback-2",
    caption: "周末散步时看到的晚霞",
    date: "城市片段",
    emoji: "🌇",
  },
  {
    _id: "fallback-3",
    caption: "旅行前随手写下的清单",
    date: "轻松记录",
    emoji: "🗺️",
  },
  {
    _id: "fallback-4",
    caption: "听歌、写字和慢慢发呆",
    date: "生活切面",
    emoji: "🎧",
  },
  {
    _id: "fallback-5",
    caption: "相机里没删掉的一帧风景",
    date: "取景练习",
    emoji: "📷",
  },
  {
    _id: "fallback-6",
    caption: "一个适合写长文的雨天",
    date: "安静时刻",
    emoji: "🌧️",
  },
];

function mapPost(document: RawDocument): Post {
  return {
    _id: String(document._id),
    title: String(document.title ?? ""),
    slug: String(document.slug ?? ""),
    excerpt: document.excerpt ? String(document.excerpt) : "",
    content: document.content ? String(document.content) : "",
    coverUrl: document.coverUrl ? String(document.coverUrl) : "",
    tags: Array.isArray(document.tags)
      ? document.tags.map((tag) => String(tag)).filter(Boolean)
      : [],
    date: document.date ? String(document.date) : "",
    views:
      typeof document.views === "number"
        ? document.views
        : Number(document.views ?? 0),
    published: Boolean(document.published),
    createdAt:
      document.createdAt instanceof Date || typeof document.createdAt === "string"
        ? document.createdAt
        : undefined,
    updatedAt:
      document.updatedAt instanceof Date || typeof document.updatedAt === "string"
        ? document.updatedAt
        : undefined,
  };
}

function mapPhoto(document: RawDocument): Photo {
  return {
    _id: String(document._id),
    url: document.url ? String(document.url) : "",
    caption: String(document.caption ?? "相册照片"),
    date: String(document.date ?? "刚刚"),
    category: document.category ? String(document.category) : "",
  };
}

async function safeQuery<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    console.error("content query failed:", error);
    return fallback;
  }
}

export async function getPublishedPosts(limit = 12): Promise<Post[]> {
  return safeQuery(async () => {
    const db = await getDb();
    const cursor = db
      .collection("posts")
      .find({ published: true })
      .sort({ createdAt: -1 });

    if (limit > 0) {
      cursor.limit(limit);
    }

    const posts = await cursor.toArray();
    return posts.map((post) => mapPost(post as RawDocument));
  }, []);
}

export async function getPublishedPost(slug: string): Promise<Post | null> {
  return safeQuery(async () => {
    const db = await getDb();
    const post = await db.collection("posts").findOne({
      slug,
      published: true,
    });

    return post ? mapPost(post as RawDocument) : null;
  }, null);
}

export async function incrementPostViews(slug: string) {
  await safeQuery(async () => {
    const db = await getDb();
    await db.collection("posts").updateOne({ slug }, { $inc: { views: 1 } });
  }, undefined);
}

export async function getStoredPhotos(limit = 24): Promise<Photo[]> {
  return safeQuery(async () => {
    const db = await getDb();
    const cursor = db.collection("photos").find().sort({ createdAt: -1 });

    if (limit > 0) {
      cursor.limit(limit);
    }

    const photos = await cursor.toArray();
    return photos.map((photo) => mapPhoto(photo as RawDocument));
  }, []);
}

export async function getLatestPhotos(limit = 24): Promise<Photo[]> {
  const storedPhotos = await getStoredPhotos(limit);

  if (storedPhotos.length > 0) {
    return storedPhotos;
  }

  const posts = await getPublishedPosts(limit * 2);
  const derivedPhotos = posts
    .filter((post) => post.coverUrl)
    .slice(0, limit)
    .map((post) => ({
      _id: `post-cover-${post._id}`,
      url: post.coverUrl,
      caption: post.title,
      date: post.date || "最新文章",
      sourceHref: `/posts/${post.slug}`,
    }));

  if (derivedPhotos.length > 0) {
    return derivedPhotos;
  }

  return FALLBACK_PHOTOS.slice(0, limit);
}

export function getPhotoCategories(photos: Photo[]): string[] {
  return Array.from(
    new Set(
      photos
        .map((p) => p.category)
        .filter((c): c is string => Boolean(c))
    )
  );
}

export function getAllTags(posts: Post[]) {
  return Array.from(
    new Set(posts.flatMap((post) => post.tags || []).filter(Boolean))
  );
}

export function filterPosts(posts: Post[], keyword: string, tag: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const normalizedTag = tag.trim();

  return posts.filter((post) => {
    const matchesKeyword =
      !normalizedKeyword ||
      [
        post.title,
        post.excerpt,
        post.content,
        ...(post.tags || []),
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedKeyword)
        );

    const matchesTag =
      !normalizedTag || (post.tags || []).includes(normalizedTag);

    return matchesKeyword && matchesTag;
  });
}
