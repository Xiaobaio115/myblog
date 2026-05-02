import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getTravelMapData, resolveCoords } from "@/lib/travel-map";
import ChinaTravelMap from "./ChinaTravelMap";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "旅行地图｜LQPP World" };

export default async function TravelMapPage() {
  const rawData = await getTravelMapData();
  const resolved = resolveCoords(rawData);

  return (
    <SiteFrame>
      <div className="world-sub-breadcrumb container">
        <Link href="/world">我的世界</Link>
        <span>›</span>
        <Link href="/world/travel">旅行探索</Link>
        <span>›</span>
        <span>旅行地图</span>
      </div>
      <ChinaTravelMap data={resolved} />
    </SiteFrame>
  );
}
