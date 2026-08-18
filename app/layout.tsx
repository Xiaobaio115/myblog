import type { Metadata } from "next";
import VirtualAssistant from "@/components/VirtualAssistant";
import { ThemeProvider } from "@/app/components/theme-provider";
import "./design-tokens.css";
import "./globals.css";
import "./poetic-theme.css";
import "./animations.css";

export const metadata: Metadata = {
  title: "LQPP World - 个人博客与数字花园",
  description:
    "LQPP 的个人世界，记录生活、技术、旅行、游戏、家乡、学校和成长经历。",
};

const THEME_INIT_SCRIPT = `(() => {
  try {
    const stored = localStorage.getItem('luna-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <VirtualAssistant />
      </body>
    </html>
  );
}
