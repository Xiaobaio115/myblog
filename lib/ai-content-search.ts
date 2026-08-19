export type ContentSearchCapabilities = {
  searchArticles: boolean;
  searchPhotos: boolean;
  searchProjects: boolean;
  searchTravel: boolean;
};

export type ContentQueryAnalysis = {
  terms: string[];
  recommendationIntent: boolean;
  articleIntent: boolean;
  photoIntent: boolean;
  projectIntent: boolean;
  travelIntent: boolean;
  searchAll: boolean;
};

export type ContentSearchPlan = {
  articles: boolean;
  photos: boolean;
  projects: boolean;
  travel: boolean;
};

export type SearchableArticle = {
  slug: string;
  title: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  series?: string;
};

const STOP_PHRASES = [
  "推荐给我",
  "相关文章",
  "相关内容",
  "类似文章",
  "旅行地图",
  "技术栈",
  "哪些地方",
  "哪些城市",
  "哪些省份",
  "找一下",
  "看一下",
  "我想了解",
  "我想看看",
  "我想看",
  "我想找",
  "我的",
  "这个",
  "帮我",
  "给我",
  "请问",
  "查询",
  "搜索",
  "推荐",
  "类似",
  "相关",
  "下一篇",
  "适合",
  "最近",
  "最新",
  "有哪些",
  "有没有",
  "打开",
  "入口",
  "在哪里",
  "在哪",
  "怎么",
  "关于",
  "文章",
  "系列",
  "笔记",
  "随笔",
  "博客",
  "阅读",
  "照片",
  "相册",
  "影像",
  "图片",
  "项目",
  "作品",
  "旅行",
  "地图",
  "城市",
  "省份",
  "去过",
  "走过",
  "足迹",
  "几篇",
  "一篇",
  "几张",
  "一些",
  "几个",
  "全部",
  "所有",
  "看看",
  "一下",
  "里面",
  "站内",
  "内容",
  "地方",
  "可以",
  "什么",
  "用了",
  "找找",
  "请",
  "找",
  "吗",
  "呢",
] as const;

function unique(items: string[]) {
  return Array.from(new Set(items));
}

function cleanText(value: unknown, maxLength = 2000) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function extractContentTerms(query: string) {
  let meaningful = query.toLowerCase();
  const phrases = [...STOP_PHRASES].sort((left, right) => right.length - left.length);
  for (const phrase of phrases) {
    meaningful = meaningful.replaceAll(phrase, " ");
  }

  const runs = meaningful.match(/[\u4e00-\u9fff]{2,}|[a-z0-9][a-z0-9._-]{1,}/gi) || [];
  return unique(runs.map((term) => term.trim()).filter((term) => term.length >= 2)).slice(0, 12);
}

export function scoreContentFields(fields: unknown[], terms: string[]) {
  const text = fields.map((field) => cleanText(field).toLowerCase()).join(" ");
  return terms.reduce(
    (score, term) => score + (text.includes(term) ? Math.max(2, term.length) : 0),
    0
  );
}

export function analyzeContentQuery(query: string): ContentQueryAnalysis {
  const normalized = query.trim().toLowerCase();
  const recommendationIntent = /推荐|相关|类似|下一篇|适合/.test(normalized);
  const photoIntent = /照片|相册|影像|图片|星空|记忆/.test(normalized);
  const projectIntent = /项目|作品|技术栈|做过|开发过|开发的/.test(normalized);
  const travelIntent = /旅行|地图|城市|省份|去过|走过|足迹/.test(normalized);
  const explicitArticleIntent = /文章|系列|笔记|随笔|博客|阅读/.test(normalized);
  const articleIntent = explicitArticleIntent ||
    (recommendationIntent && !photoIntent && !projectIntent && !travelIntent) ||
    (!projectIntent && /技术/.test(normalized));
  const terms = extractContentTerms(normalized);
  const hasIntent = articleIntent || photoIntent || projectIntent || travelIntent;

  return {
    terms,
    recommendationIntent,
    articleIntent,
    photoIntent,
    projectIntent,
    travelIntent,
    searchAll: !hasIntent,
  };
}

export function createContentSearchPlan(
  analysis: ContentQueryAnalysis,
  capabilities: ContentSearchCapabilities
): ContentSearchPlan {
  return {
    articles: capabilities.searchArticles && (analysis.articleIntent || analysis.searchAll),
    photos: capabilities.searchPhotos && (analysis.photoIntent || analysis.searchAll),
    projects: capabilities.searchProjects && (analysis.projectIntent || analysis.searchAll),
    travel: capabilities.searchTravel && (analysis.travelIntent || analysis.searchAll),
  };
}

export function rankArticleCandidates<T extends SearchableArticle>(
  posts: T[],
  options: {
    terms: string[];
    recommendationIntent: boolean;
    currentSlug?: string;
    currentPost?: T;
    limit?: number;
  }
) {
  const terms = unique(options.terms.map((term) => term.trim().toLowerCase()).filter(Boolean));
  const currentTags = new Set((options.currentPost?.tags || []).map((tag) => tag.trim()).filter(Boolean));
  const useCurrentArticleSignals = Boolean(
    options.recommendationIntent && options.currentPost && terms.length === 0
  );

  const ranked = posts
    .filter((post) => !options.currentSlug || post.slug !== options.currentSlug)
    .map((post, index) => {
      let score = scoreContentFields(
        [post.title, post.excerpt, post.series, post.tags, post.content],
        terms
      );

      if (useCurrentArticleSignals) {
        if (options.currentPost?.series?.trim() && post.series?.trim() === options.currentPost.series.trim()) {
          score += 40;
        }
        const sharedTagCount = (post.tags || []).filter((tag) => currentTags.has(tag.trim())).length;
        score += sharedTagCount * 12;
      }

      return { post, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const matched = terms.length > 0 ? ranked.filter((item) => item.score > 0) : ranked;
  const candidates = matched.length > 0 || !options.recommendationIntent ? matched : ranked;
  return candidates.slice(0, options.limit ?? 5).map(({ post }) => post);
}
