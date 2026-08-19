import { NextResponse } from "next/server";
import {
  getProfileSetting,
  getSocialsSetting,
  getSkillsSetting,
  getEducationSetting,
  getProjectsSetting,
  getTravelSetting,
  getWorldSectionsSetting,
  getHomeHeroSetting,
  saveSetting,
  normalizeHomeHeroSetting,
} from "@/lib/settings";
import { verifyAdminPassword } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "服务端尚未配置 ADMIN_PASSWORD。" }, { status: 500 });
    }

    if (!verifyAdminPassword(request.headers.get("x-admin-password"))) {
      return NextResponse.json({ error: "密码错误。" }, { status: 401 });
    }

    const [profile, socials, skills, education, projects, travel, world, homeHero] = await Promise.all([
      getProfileSetting(),
      getSocialsSetting(),
      getSkillsSetting(),
      getEducationSetting(),
      getProjectsSetting(),
      getTravelSetting(),
      getWorldSectionsSetting(),
      getHomeHeroSetting(),
    ]);

    return NextResponse.json({ profile, socials, skills, education, projects, travel, world, homeHero });
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

    if (!verifyAdminPassword(adminPassword)) {
      return NextResponse.json({ error: "密码错误。" }, { status: 401 });
    }

    const body = await request.json();
    const { key, value } = body as { key: string; value: unknown };

    const allowed = ["profile", "socials", "skills", "education", "projects", "travel", "world", "homeHero"];
    if (!allowed.includes(key)) {
      return NextResponse.json({ error: "不支持的设置 key。" }, { status: 400 });
    }

    const nextValue = key === "homeHero" ? normalizeHomeHeroSetting(value) : value;
    if (key === "homeHero" && !nextValue) {
      return NextResponse.json({ error: "首页轮播数据格式不正确，最多支持 12 项。" }, { status: 400 });
    }

    await saveSetting(key, nextValue);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json({ error: "保存设置失败。" }, { status: 500 });
  }
}
