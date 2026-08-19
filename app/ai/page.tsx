import type { Metadata } from "next";
import AiChatPage from "./AiChatPage";

export const metadata: Metadata = {
  title: "甘蔗 AI - LQPP World",
  description: "在 LQPP World 使用甘蔗 AI 进行长对话、查询文章与探索站点内容。",
  robots: { index: false, follow: false },
};

export default function AiPage() {
  return <AiChatPage />;
}
