import { getDb } from "@/lib/mongodb";

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

type RawSeriesMeta = Record<string, unknown> & {
  _id?: { toString(): string } | string;
};

function mapSeriesMeta(doc: RawSeriesMeta): SeriesMeta {
  const rawCategory = String(doc.category ?? "");
  const category = (Object.keys(SERIES_CATEGORIES) as SeriesCategory[]).includes(
    rawCategory as SeriesCategory
  )
    ? (rawCategory as SeriesCategory)
    : "life";

  return {
    name: String(doc.name ?? "").trim(),
    category,
    description: String(doc.description ?? ""),
    cover: String(doc.cover ?? ""),
    sortOrder:
      typeof doc.sortOrder === "number" && Number.isFinite(doc.sortOrder)
        ? doc.sortOrder
        : 0,
  };
}

export async function getAllSeriesMeta(): Promise<SeriesMeta[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection("series_meta")
      .find()
      .sort({ sortOrder: 1, name: 1 })
      .toArray();
    return docs.map((doc) => mapSeriesMeta(doc as RawSeriesMeta));
  } catch {
    return [];
  }
}