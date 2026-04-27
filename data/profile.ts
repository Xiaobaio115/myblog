export const profile = {
  name: "LQPP",
  siteName: "LQPP World",
  tagline: "生活、技术、旅行与游戏构成的个人宇宙。",
  intro:
    "你好，我是 LQPP。这里记录我的生活、技术、家乡、学校、旅行、游戏，以及一些慢慢长大的想法。",
  status: "正在建设自己的数字花园",
  location: "中国 · 地球在线",
  avatarUrl: "",
  email: "your-email@example.com",
  githubUrl: "https://github.com/yourname",
  tags: ["学生", "博客作者", "代码学习者", "旅行探索者", "游戏玩家"],
};

export const socials = [
  { label: "Email", value: profile.email, href: `mailto:${profile.email}` },
  { label: "GitHub", value: "github.com/yourname", href: profile.githubUrl },
  { label: "B站", value: "Bilibili", href: "#" },
  { label: "微博", value: "Weibo", href: "#" },
];

export const skills = [
  {
    group: "正在使用",
    items: ["HTML", "CSS", "JavaScript", "React", "Next.js", "Markdown", "Git"],
  },
  {
    group: "正在学习",
    items: ["Node.js", "Python", "数据库", "算法", "AI 辅助编程", "性能优化"],
  },
  {
    group: "想继续探索",
    items: ["全栈开发", "个人知识库", "旅行地图", "游戏开发", "Web 动效", "3D 交互"],
  },
];

export const education = [
  {
    time: "202X - 至今",
    title: "学校名称 / 专业方向",
    desc: "在这里我开始系统学习技术，也逐渐意识到自己想把兴趣、记录和作品结合起来。这个网站就是其中一个长期项目。",
    tags: ["编程", "课程", "成长", "项目"],
  },
  {
    time: "过去",
    title: "学习与成长阶段",
    desc: "慢慢积累自己的兴趣：记录生活、探索工具、尝试把想法做成真正可以访问的页面。",
    tags: ["记录", "探索", "兴趣"],
  },
];
