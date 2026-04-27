export const worldSections = [
  {
    id: "hometown",
    eyebrow: "Hometown",
    title: "我的家乡",
    subtitle: "家乡是我世界地图上的第一个坐标。",
    desc: "这里是我出发的地方。它保存着很多普通但珍贵的记忆：熟悉的街道、吃过的味道、见过很多次的天空，还有每次离开后仍然会想起的生活感。",
    tags: ["家乡", "小城", "美食", "记忆", "天空"],
    cta: "进入家乡页面",
    href: "/world/hometown",
    cover: "",
    icon: "🏡",
  },
  {
    id: "school",
    eyebrow: "School",
    title: "我的学校",
    subtitle: "学校记录了我学习、变化和慢慢确定方向的过程。",
    desc: "这一阶段让我开始认真学习技术，也让我想把自己的想法做成真实可访问的网站。",
    tags: ["课程", "编程", "朋友", "成长", "项目"],
    cta: "进入学校页面",
    href: "/world/school",
    cover: "",
    icon: "🏫",
  },
  {
    id: "travel",
    eyebrow: "Travel",
    title: "旅行探索",
    subtitle: "每一次出发，都会在我的地图上点亮一个新的坐标。",
    desc: "旅行对我来说不只是到达一个地点，更像是给自己的生活增加一个新坐标。",
    tags: ["风景", "城市", "照片", "计划外", "路上"],
    cta: "进入旅行探索",
    href: "/world/travel",
    cover: "",
    icon: "✈️",
  },
  {
    id: "games",
    eyebrow: "Games",
    title: "游戏世界",
    subtitle: "游戏也是一种探索世界的方式。",
    desc: "在游戏里建造、冒险、和朋友一起完成目标，也会成为个人世界的一部分。",
    tags: ["Minecraft", "Steam", "建造", "冒险", "朋友"],
    cta: "进入游戏世界",
    href: "/world/games",
    cover: "",
    icon: "🎮",
  },
];

export const personality = [
  { title: "喜欢记录", desc: "会把生活碎片变成文字、照片或网页。" },
  { title: "喜欢探索", desc: "对新的城市、工具、游戏和技术都感兴趣。" },
  { title: "喜欢折腾", desc: "会不断改网站、试组件、搭建自己的系统。" },
  { title: "游戏玩家", desc: "游戏是另一种世界探索方式。" },
  { title: "慢慢成长", desc: "网站和我都会持续更新。" },
];

export const worldLogs = [
  "2026.04：开始重构个人博客",
  "2026.04：加入 3D 星空相册",
  "2026.05：计划继续完善我的世界页面",
  "未来：加入旅行地图、留言板、项目页",
];

export const travelDestinations = [
  {
    id: "yunnan-dali",
    name: "云南·大理",
    date: "2025.08",
    desc: "大理，一个让人呼吸的地方。苍天、白云、洱海、古城，每一处都让人流连忘返。",
    cover: "",
    photos: [] as string[],
    tags: ["古城", "洱海", "苍山", "白族文化"],
  },
  {
    id: "sichuan-chengdu",
    name: "四川·成都",
    date: "2025.05",
    desc: "成都，一座来了就不想走的城市。宽窄巷子、火锅、熊猫，还有那种慢节奏的生活气息。",
    cover: "",
    photos: [] as string[],
    tags: ["火锅", "宽窄巷子", "熊猫", "慢生活"],
  },
  {
    id: "tibet-lhasa",
    name: "西藏·拉萨",
    date: "2024.07",
    desc: "离天空最近的地方。布达拉宫、纳木错、转经筒，感受到一种对生活的全新理解。",
    cover: "",
    photos: [] as string[],
    tags: ["布达拉宫", "高原", "藏族文化", "纳木错"],
  },
  {
    id: "zhejiang-hangzhou",
    name: "浙江·杭州",
    date: "2024.03",
    desc: "西湖、灵隐寺，还有那杯龙井。上有天堂，下有苏杭，此话不假。",
    cover: "",
    photos: [] as string[],
    tags: ["西湖", "龙井", "灵隐寺", "江南"],
  },
  {
    id: "guangdong-zhuhai",
    name: "广东·珠海",
    date: "2023.12",
    desc: "珠海，一个干净又安静的海滨城市。海风、情侣路、港珠澳大桥，让人心情很好。",
    cover: "",
    photos: [] as string[],
    tags: ["海滨", "情侣路", "港珠澳", "海鲜"],
  },
];

export const gamesList = [
  {
    id: "minecraft",
    name: "Minecraft",
    type: "沙盒·建造",
    date: "2020 至今",
    desc: "从生存到创造，在方块世界里搭建自己的家园。可以说是陪伴最久的一款游戏。",
    cover: "",
    tags: ["建造", "生存", "红石", "服务器"],
  },
  {
    id: "steam-indie",
    name: "Steam 独立游戏",
    type: "独立·剧情",
    date: "不定期",
    desc: "喜欢剧情丰富或者玩法独特的独立游戏，比如 Hollow Knight、Celeste、Stardew Valley。",
    cover: "",
    tags: ["Hollow Knight", "Celeste", "Stardew Valley", "独立游戏"],
  },
  {
    id: "genshin",
    name: "原神",
    type: "开放世界·RPG",
    date: "2021 - 2023",
    desc: "提瓦特大陆的旅行者。美丽的场景设计和音乐让我印象深刻。",
    cover: "",
    tags: ["开放世界", "剧情", "探索", "音乐"],
  },
];

export const hometownContent = {
  title: "我的家乡",
  subtitle: "出发的地方",
  desc: "每个人的世界地图都有一个原点。我的原点在这里——一个普通但留满了记忆的小城。那里有熟悉的街道、固定的季节气味、每次回去都不会变的那家小馆子。我在这里长大，然后慢慢出发，但它始终是我坐标系里最先标出的一个点。",
  details: [
    { label: "地区", value: "（待填写）" },
    { label: "特色", value: "小城、老街、家乡味" },
    { label: "记忆", value: "童年、天空、味道" },
  ],
  photos: [] as string[],
};

export const schoolContent = {
  title: "我的学校",
  subtitle: "成长坐标",
  desc: "学校是我认真开始学技术的地方，也是我想清楚自己想做什么的地方。在这里我开始学编程、开始搭网站、开始想把自己的想法变成真实可以访问的东西。这个博客本身，就是这段经历的一部分。",
  details: [
    { label: "阶段", value: "在读" },
    { label: "方向", value: "计算机 / 软件开发" },
    { label: "正在做", value: "学技术 + 搭这个网站" },
  ],
  photos: [] as string[],
};
