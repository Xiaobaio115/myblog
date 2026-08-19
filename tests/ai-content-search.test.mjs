import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeContentQuery,
  createContentSearchPlan,
  extractContentTerms,
  rankArticleCandidates,
} from "../lib/ai-content-search.ts";
import { isSafeInternalHref } from "../lib/internal-href.ts";

test("navigation actions accept only bounded same-site paths", () => {
  assert.equal(isSafeInternalHref("/articles?series=React"), true);
  assert.equal(isSafeInternalHref("https://example.com"), false);
  assert.equal(isSafeInternalHref("//example.com"), false);
  assert.equal(isSafeInternalHref("/\\example.com"), false);
  assert.equal(isSafeInternalHref("/articles\nnext"), false);
  assert.equal(isSafeInternalHref(`/${"a".repeat(501)}`), false);
});

test("generic content phrases are not treated as search keywords", () => {
  assert.deepEqual(extractContentTerms("推荐几篇相关文章"), []);
  assert.deepEqual(extractContentTerms("旅行地图去过哪些地方"), []);
  assert.deepEqual(extractContentTerms("找一些照片看看"), []);
  assert.deepEqual(extractContentTerms("看看我的项目"), []);
  assert.deepEqual(extractContentTerms("推荐 React 技术文章"), ["react", "技术"]);
});

test("domain-specific recommendations do not trigger unrelated sources", () => {
  const capabilities = {
    searchArticles: true,
    searchPhotos: true,
    searchProjects: true,
    searchTravel: true,
  };

  const photoPlan = createContentSearchPlan(analyzeContentQuery("推荐一些照片"), capabilities);
  assert.deepEqual(photoPlan, { articles: false, photos: true, projects: false, travel: false });

  const projectPlan = createContentSearchPlan(analyzeContentQuery("推荐几个项目"), capabilities);
  assert.deepEqual(projectPlan, { articles: false, photos: false, projects: true, travel: false });
});

test("disabled content sources are excluded from the search plan", () => {
  const plan = createContentSearchPlan(analyzeContentQuery("React"), {
    searchArticles: false,
    searchPhotos: true,
    searchProjects: false,
    searchTravel: true,
  });

  assert.deepEqual(plan, { articles: false, photos: true, projects: false, travel: true });
});

test("article recommendations exclude the current article and favor series then tags", () => {
  const current = {
    slug: "current",
    title: "Next.js 入门",
    series: "Next.js 实战",
    tags: ["Next.js", "React"],
  };
  const sameSeries = {
    slug: "same-series",
    title: "路由与布局",
    series: "Next.js 实战",
    tags: ["Web"],
  };
  const sameTag = {
    slug: "same-tag",
    title: "React 状态管理",
    series: "前端札记",
    tags: ["React"],
  };
  const unrelated = {
    slug: "unrelated",
    title: "旅行随笔",
    series: "远方",
    tags: ["旅行"],
  };

  const ranked = rankArticleCandidates(
    [current, unrelated, sameTag, sameSeries],
    {
      terms: [],
      recommendationIntent: true,
      currentSlug: current.slug,
      currentPost: current,
      limit: 3,
    }
  );

  assert.deepEqual(ranked.map((post) => post.slug), ["same-series", "same-tag", "unrelated"]);
});

test("explicit article keywords take priority over the current page context", () => {
  const current = {
    slug: "current",
    title: "旅行随笔",
    series: "远方",
    tags: ["旅行"],
  };
  const ranked = rankArticleCandidates(
    [
      current,
      { slug: "same-series", title: "海边", series: "远方", tags: ["旅行"] },
      { slug: "react", title: "React 组件设计", series: "前端札记", tags: ["React"] },
    ],
    {
      terms: ["react"],
      recommendationIntent: true,
      currentSlug: current.slug,
      currentPost: current,
    }
  );

  assert.deepEqual(ranked.map((post) => post.slug), ["react"]);
});
