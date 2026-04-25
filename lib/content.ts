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

export type PostVisit = {
  _id: string;
  slug: string;
  ip: string;
  device: string;
  platform: string;
  browser: string;
  userAgent: string;
  createdAt?: Date | string;
};

export type TrafficPoint = {
  key: string;
  label: string;
  pv: number;
  uv: number;
};

export type TrafficOverview = {
  totalPv: number;
  totalUv: number;
  recentPv: number;
  recentUv: number;
  daily: TrafficPoint[];
};

export type TopPostTraffic = {
  _id: string;
  title: string;
  slug: string;
  views: number;
  uv: number;
  date?: string;
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

type PostVisitInput = {
  ip?: string;
  device?: string;
  platform?: string;
  browser?: string;
  userAgent?: string;
};

const POST_VIEW_DEDUP_WINDOW_MS = 10 * 60 * 1000;
const TRAFFIC_TIME_ZONE = "Asia/Shanghai";

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

function mapPostVisit(document: RawDocument): PostVisit {
  return {
    _id: String(document._id),
    slug: String(document.slug ?? ""),
    ip: document.ip ? String(document.ip) : "",
    device: document.device ? String(document.device) : "",
    platform: document.platform ? String(document.platform) : "",
    browser: document.browser ? String(document.browser) : "",
    userAgent: document.userAgent ? String(document.userAgent) : "",
    createdAt:
      document.createdAt instanceof Date || typeof document.createdAt === "string"
        ? document.createdAt
        : undefined,
  };
}

function formatTrafficKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TRAFFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";

  return `${year}-${month}-${day}`;
}

function formatTrafficLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TRAFFIC_TIME_ZONE,
    month: "numeric",
    day: "numeric",
  }).format(date);
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

function sanitizeVisitField(value: string | undefined, fallback: string) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, 240);
}

export async function trackPostView(
  slug: string,
  visit: PostVisitInput
): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const ip = sanitizeVisitField(visit.ip, "unknown");
  const device = sanitizeVisitField(visit.device, "Unknown device");
  const platform = sanitizeVisitField(visit.platform, "Unknown platform");
  const browser = sanitizeVisitField(visit.browser, "Unknown browser");
  const userAgent = sanitizeVisitField(visit.userAgent, "");
  const dedupeBoundary = new Date(now.getTime() - POST_VIEW_DEDUP_WINDOW_MS);
  const recentVisit = await db.collection("post_visits").findOne(
    {
      slug,
      ip,
      userAgent,
      createdAt: { $gte: dedupeBoundary },
    },
    {
      projection: { _id: 1 },
    }
  );

  if (recentVisit) {
    const existingPost = await db.collection("posts").findOne(
      { slug, published: true },
      { projection: { views: 1 } }
    );

    if (!existingPost) {
      throw new Error("Post not found");
    }

    return Number(existingPost.views ?? 0);
  }

  const updated = await db.collection("posts").findOneAndUpdate(
    { slug, published: true },
    {
      $inc: { views: 1 },
      $set: { updatedAt: now },
    },
    {
      returnDocument: "after",
      projection: { views: 1 },
    }
  );

  if (!updated) {
    throw new Error("Post not found");
  }

  await db.collection("post_visits").insertOne({
    slug,
    ip,
    device,
    platform,
    browser,
    userAgent,
    createdAt: now,
  });

  return Number(updated.views ?? 0);
}

export async function getRecentPostVisits(
  slug: string,
  limit = 12
): Promise<PostVisit[]> {
  return safeQuery(async () => {
    const db = await getDb();
    const cursor = db
      .collection("post_visits")
      .find({ slug })
      .sort({ createdAt: -1 });

    if (limit > 0) {
      cursor.limit(limit);
    }

    const visits = await cursor.toArray();
    return visits.map((visit) => mapPostVisit(visit as RawDocument));
  }, []);
}

export async function getLatestPostVisitsBySlugs(
  slugs: string[]
): Promise<Record<string, PostVisit>> {
  return safeQuery(async () => {
    const normalizedSlugs = Array.from(
      new Set(slugs.map((slug) => slug.trim()).filter(Boolean))
    );

    if (normalizedSlugs.length === 0) {
      return {};
    }

    const db = await getDb();
    const visits = await db
      .collection("post_visits")
      .find({ slug: { $in: normalizedSlugs } })
      .sort({ createdAt: -1 })
      .toArray();

    const latestVisits: Record<string, PostVisit> = {};

    for (const visit of visits) {
      const mappedVisit = mapPostVisit(visit as RawDocument);

      if (!mappedVisit.slug || latestVisits[mappedVisit.slug]) {
        continue;
      }

      latestVisits[mappedVisit.slug] = mappedVisit;
    }

    return latestVisits;
  }, {});
}

export async function getUniqueVisitorCountsBySlugs(
  slugs: string[]
): Promise<Record<string, number>> {
  return safeQuery(async () => {
    const normalizedSlugs = Array.from(
      new Set(slugs.map((slug) => slug.trim()).filter(Boolean))
    );

    if (normalizedSlugs.length === 0) {
      return {};
    }

    const db = await getDb();
    const aggregates = await db
      .collection("post_visits")
      .aggregate<{
        _id: string;
        count: number;
      }>([
        {
          $match: {
            slug: { $in: normalizedSlugs },
          },
        },
        {
          $group: {
            _id: {
              slug: "$slug",
              ip: "$ip",
              userAgent: "$userAgent",
            },
          },
        },
        {
          $group: {
            _id: "$_id.slug",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    return Object.fromEntries(
      aggregates.map((item) => [String(item._id), Number(item.count ?? 0)])
    );
  }, {});
}

export async function getTrafficOverview(days = 7): Promise<TrafficOverview> {
  return safeQuery(async () => {
    const normalizedDays = Math.max(1, Math.floor(days));
    const db = await getDb();
    const rangeStart = new Date(
      Date.now() - (normalizedDays + 1) * 24 * 60 * 60 * 1000
    );

    const [totalPvAggregate, totalUvAggregate, recentVisits] = await Promise.all([
      db
        .collection("posts")
        .aggregate<{ _id: null; total: number }>([
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ["$views", 0] } },
            },
          },
        ])
        .toArray(),
      db
        .collection("post_visits")
        .aggregate<{ _id: null; total: number }>([
          {
            $group: {
              _id: {
                ip: "$ip",
                userAgent: "$userAgent",
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      db
        .collection("post_visits")
        .find({
          createdAt: { $gte: rangeStart },
        })
        .project({
          ip: 1,
          userAgent: 1,
          createdAt: 1,
        })
        .toArray(),
    ]);

    const daily = Array.from({ length: normalizedDays }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (normalizedDays - 1 - index));

      return {
        key: formatTrafficKey(date),
        label: formatTrafficLabel(date),
        pv: 0,
        uv: 0,
      };
    });

    const dailyMap = new Map(
      daily.map((point) => [
        point.key,
        {
          point,
          visitors: new Set<string>(),
        },
      ])
    );
    const recentVisitors = new Set<string>();

    for (const visit of recentVisits) {
      const createdAt =
        visit.createdAt instanceof Date
          ? visit.createdAt
          : new Date(String(visit.createdAt || ""));

      if (Number.isNaN(createdAt.getTime())) {
        continue;
      }

      const key = formatTrafficKey(createdAt);
      const bucket = dailyMap.get(key);

      if (!bucket) {
        continue;
      }

      const identity = `${String(visit.ip ?? "unknown")}::${String(
        visit.userAgent ?? ""
      )}`;
      bucket.point.pv += 1;
      bucket.visitors.add(identity);
      recentVisitors.add(identity);
    }

    for (const bucket of dailyMap.values()) {
      bucket.point.uv = bucket.visitors.size;
    }

    return {
      totalPv: Number(totalPvAggregate[0]?.total ?? 0),
      totalUv: Number(totalUvAggregate[0]?.total ?? 0),
      recentPv: daily.reduce((sum, point) => sum + point.pv, 0),
      recentUv: recentVisitors.size,
      daily,
    };
  }, {
    totalPv: 0,
    totalUv: 0,
    recentPv: 0,
    recentUv: 0,
    daily: [],
  });
}

export async function getTopPostsByTraffic(
  limit = 5
): Promise<TopPostTraffic[]> {
  return safeQuery(async () => {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const db = await getDb();
    const posts = await db
      .collection("posts")
      .find({ published: true })
      .sort({ views: -1, createdAt: -1 })
      .limit(normalizedLimit)
      .toArray();

    const mappedPosts = posts.map((post) => mapPost(post as RawDocument));
    const uvCounts = await getUniqueVisitorCountsBySlugs(
      mappedPosts.map((post) => post.slug)
    );

    return mappedPosts.map((post) => ({
      _id: post._id,
      title: post.title,
      slug: post.slug,
      views: Number(post.views ?? 0),
      uv: uvCounts[post.slug] || 0,
      date: post.date,
    }));
  }, []);
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
