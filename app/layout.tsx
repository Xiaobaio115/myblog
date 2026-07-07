import type { Metadata } from "next";
import VirtualAssistant from "@/components/VirtualAssistant";
import { ThemeProvider } from "@/app/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "LQPP World - 个人博客与数字花园",
  description:
    "LQPP 的个人世界，记录生活、技术、旅行、游戏、家乡、学校和成长经历。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="light" data-scroll-behavior="smooth">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <VirtualAssistant />
      </body>
    </html>
  );
}
