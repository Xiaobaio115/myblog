export const worldSections = [
  {
    id: "hometown",
    eyebrow: "Hometown",
    title: "我的家乡",
    subtitle: "家乡是我世界地图上的第一个坐标。",
    desc: "这里是我出发的地方。熟悉的街道、吃过的味道、看过很多次的天空，都构成了最早的生活记忆。",
    tags: ["家乡", "小城", "美食", "记忆", "天空"],
    cta: "进入家乡页面",
    href: "/world/hometown",
    cover: "",
    icon: "Home",
  },
  {
    id: "school",
    eyebrow: "School",
    title: "我的学校",
    subtitle: "学校记录了我学习、变化和确定方向的过程。",
    desc: "这一阶段让我开始认真学习技术，也让我想把自己的想法做成真实可访问的网站。",
    tags: ["课程", "编程", "朋友", "成长", "项目"],
    cta: "进入学校页面",
    href: "/world/school",
    cover: "",
    icon: "School",
  },
  {
    id: "travel",
    eyebrow: "Travel",
    title: "旅行探索",
    subtitle: "每一次出发，都会在地图上点亮一个新的坐标。",
    desc: "旅行对我来说不只是抵达一个地点，更像是给生活增加一个新的视角。",
    tags: ["风景", "城市", "照片", "计划", "路上"],
    cta: "进入旅行探索",
    href: "/world/travel",
    cover: "",
    icon: "Travel",
  },
];

export const personality = [
  { title: "喜欢记录", desc: "会把生活片段变成文字、照片或网页。" },
  { title: "喜欢探索", desc: "对新的城市、工具和技术都感兴趣。" },
  { title: "喜欢折腾", desc: "会不断改网站、试组件、搭建自己的系统。" },
  
  { title: "慢慢成长", desc: "网站和我都会持续更新。" },
];

// TODO(上线前): 补一条最新的更新。这份日志会显示在 /world 页面底部。
export const worldLogs = [
  "2026.04：开始重构个人博客",
  "2026.04：加入 3D 星空相册",
  "2026.05：继续完善我的世界页面",
  "2026.07：全站粉色视觉统一 + 深色主题回归",
  "未来：加入更完整的旅行地图、留言板和项目页",
];


// TODO(上线前): 在 /admin 或此文件中补上真实的家乡地区。目前 details[0] 是中性占位。
export const hometownContent = {
  title: "我的家乡",
  subtitle: "出发的地方",
  desc: "每个人的世界地图都有一个原点。我的原点在这里，一个普通但装满记忆的小城。",
  details: [
    { label: "地区", value: "中国 · 海南" },
    { label: "特色", value: "小城、老街、家乡味" },
    { label: "记忆", value: "童年、天空、味道" },
  ],
  photos: [] as string[],
};

// TODO(上线前): 学校阶段与方向可保留，也可按实际情况细化。隐私要求见 06_视觉系统与实现约束.md §7。
export const schoolContent = {
  title: "我的学校",
  subtitle: "成长坐标",
  desc: "学校是我认真开始学技术的地方，也是我想清楚自己想做什么的地方。这个博客本身，就是这段经历的一部分。",
  details: [
    { label: "阶段", value: "在读" },
    { label: "方向", value: "计算机 / 软件开发" },
    { label: "正在做", value: "学技术 + 搭这个网站" },
  ],
  photos: [] as string[],
};
