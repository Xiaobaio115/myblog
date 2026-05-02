import { NextResponse } from "next/server";
import { getTravelMapData, saveTravelMapData } from "@/lib/travel-map";
import type { TravelMapData } from "@/data/travel-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getTravelMapData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/travel-map error:", error);
    return NextResponse.json({ error: "读取旅行地图数据失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const adminPassword = request.headers.get("x-admin-password");
    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "服务端未配置 ADMIN_PASSWORD" }, { status: 500 });
    }
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const body = await request.json();
    const { data } = body as { data: TravelMapData };

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "无效的旅行地图数据" }, { status: 400 });
    }

    await saveTravelMapData(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/travel-map error:", error);
    return NextResponse.json({ error: "保存旅行地图数据失败" }, { status: 500 });
  }
}
