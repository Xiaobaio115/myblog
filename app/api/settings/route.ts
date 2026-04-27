import { NextResponse } from "next/server";
import {
  getProfileSetting,
  getSocialsSetting,
  getSkillsSetting,
  getEducationSetting,
  getProjectsSetting,
  getTravelSetting,
  getGamesSetting,
  getWorldSectionsSetting,
  saveSetting,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [profile, socials, skills, education, projects, travel, games, world] = await Promise.all([
      getProfileSetting(),
      getSocialsSetting(),
      getSkillsSetting(),
      getEducationSetting(),
      getProjectsSetting(),
      getTravelSetting(),
      getGamesSetting(),
      getWorldSectionsSetting(),
    ]);

    return NextResponse.json({ profile, socials, skills, education, projects, travel, games, world });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "读取设置失败。" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const adminPassword = request.headers.get("x-admin-password");

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "服务端尚未配置 ADMIN_PASSWORD。" }, { status: 500 });
    }

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "密码错误。" }, { status: 401 });
    }

    const body = await request.json();
    const { key, value } = body as { key: string; value: unknown };

    const allowed = ["profile", "socials", "skills", "education", "projects", "travel", "games", "world"];
    if (!allowed.includes(key)) {
      return NextResponse.json({ error: "不支持的设置 key。" }, { status: 400 });
    }

    await saveSetting(key, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json({ error: "保存设置失败。" }, { status: 500 });
  }
}
