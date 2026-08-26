export const SERIES_CATEGORIES: Record<string, string> = {
  travel: "旅行",
  tech: "科技",
  coding: "技术",
  life: "生活",
};

export type SeriesCategory = keyof typeof SERIES_CATEGORIES;

export type SeriesMeta = {
  name: string;
  category: SeriesCategory;
  description: string;
  cover: string;
  sortOrder: number;
};