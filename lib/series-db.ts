import "server-only";

import { getDb } from "@/lib/mongodb";
import { type SeriesMeta, SERIES_CATEGORIES } from "@/lib/series";

type RawSeriesMeta = Record<string, unknown> & {
  _id?: { toString(): string } | string;
};

function mapSeriesMeta(doc: RawSeriesMeta): SeriesMeta {
  const rawCategory = String(doc.category ?? "");
  const category = (Object.keys(SERIES_CATEGORIES) as SeriesMeta["category"][]).includes(
    rawCategory as SeriesMeta["category"]
  )
    ? (rawCategory as SeriesMeta["category"])
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