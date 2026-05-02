import { getDb } from "@/lib/mongodb";
import { travelMapData as defaultData, resolveCoords, CITY_COORDS, PROV_COORDS } from "@/data/travel-map";
import type { TravelMapData } from "@/data/travel-map";

export async function getTravelMapData(): Promise<TravelMapData> {
  try {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ key: "travelMap" });
    if (doc?.value) return doc.value as TravelMapData;
    return defaultData;
  } catch {
    return defaultData;
  }
}

export async function saveTravelMapData(data: TravelMapData): Promise<void> {
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key: "travelMap" },
    { $set: { key: "travelMap", value: data, updatedAt: new Date() } },
    { upsert: true }
  );
}

export { resolveCoords, CITY_COORDS, PROV_COORDS };
