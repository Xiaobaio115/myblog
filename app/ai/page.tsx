import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AiChatPage from "./AiChatPage";
import { hasAdminSession } from "@/lib/admin-session";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ developer?: string }>;
}): Promise<Metadata> {
  const developerMode = (await searchParams).developer === "1";
  return {
    title: developerMode ? "Developer AI - LQPP Admin" : "甘蔗 AI - LQPP World",
    description: developerMode
      ? "管理员专用的原始模型对话页面。"
      : "在 LQPP World 使用甘蔗 AI 进行长对话、查询文章与探索站点内容。",
    robots: { index: false, follow: false },
  };
}

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ developer?: string }>;
}) {
  const developerMode = (await searchParams).developer === "1";
  if (developerMode && !(await hasAdminSession())) redirect("/admin");
  return <AiChatPage developerMode={developerMode} />;
}
