export const profile = {
  name: "甘蔗甜不甜",
  siteName: "LQPP World",
  tagline: "Stay hungry, stay foolish.",
  intro:
    "你好，我是 LQPP。这里记录我的生活、技术、家乡、学校、旅行、游戏，以及一些慢慢长大的想法。",
  status: "正在逃早八中",
  location: "中国 · 海南",
  avatarUrl: "",
  email: "3559078927@qq.com",
  githubUrl: "https://github.com/yourname",
  tags: ["学生", "博客作者", "代码学习者", "旅行探索者", "游戏玩家"],
};

export const socials = [
  { label: "Email", value: profile.email, href: `mailto:${profile.email}` },
  { label: "GitHub", value: "GitHub", href: profile.githubUrl },
  { label: "B 站", value: "Bilibili", href: "#" },
  { label: "微博", value: "Weibo", href: "#" },
];

export const skills = [
  {
    group: "正在使用",
    items: [
      { name: "HTML", iconUrl: "https://cdn.simpleicons.org/html5/E34F26" },
      { name: "CSS", iconUrl: "https://cdn.simpleicons.org/css/663399" },
      { name: "JavaScript", iconUrl: "https://cdn.simpleicons.org/javascript/F7DF1E" },
      { name: "React", iconUrl: "https://cdn.simpleicons.org/react/61DAFB" },
      { name: "Next.js", iconUrl: "https://cdn.simpleicons.org/nextdotjs/000000" },
      { name: "Markdown", iconUrl: "https://cdn.simpleicons.org/markdown/000000" },
      { name: "Git", iconUrl: "https://cdn.simpleicons.org/git/F05032" },
    ],
  },
  {
    group: "正在学习",
    items: [
      { name: "Node.js", iconUrl: "https://cdn.simpleicons.org/nodedotjs/5FA04E" },
      { name: "Python", iconUrl: "https://cdn.simpleicons.org/python/3776AB" },
      { name: "MongoDB", iconUrl: "https://cdn.simpleicons.org/mongodb/47A248" },
      { name: "算法" },
      { name: "AI 辅助编程", iconUrl: "https://cdn.simpleicons.org/openai/412991" },
      { name: "性能优化" },
    ],
  },
  {
    group: "想继续探索",
    items: [
      { name: "全栈开发" },
      { name: "个人知识库", iconUrl: "https://cdn.simpleicons.org/obsidian/7C3AED" },
      { name: "旅行地图" },
      { name: "游戏开发", iconUrl: "https://cdn.simpleicons.org/unity/000000" },
      { name: "Web 动效" },
      { name: "3D 交互", iconUrl: "https://cdn.simpleicons.org/threedotjs/000000" },
    ],
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
