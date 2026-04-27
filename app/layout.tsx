import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import VirtualAssistant from "@/components/VirtualAssistant";
import { ThemeProvider } from "@/app/components/theme-provider";
import "./globals.css";

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "LQPP World｜个人博客与数字花园",
  description: "LQPP 的个人世界，记录生活、技术、旅行、游戏、家乡、学校和成长经历。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('luna-theme');if(t==='dark'||t==='blue'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <VirtualAssistant />
      </body>
    </html>
  );
}
