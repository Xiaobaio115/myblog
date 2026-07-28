This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 手机聊天通知

右下角聊天已支持将访客发送的消息同步通知到站长手机：

1. 推荐使用 [Server酱](https://sct.ftqq.com/)：绑定微信并把 SendKey 配置为 `SERVERCHAN_SEND_KEY`。
2. 也可以配置 `CHAT_WEBHOOK_URL` 使用任意通用 Webhook；需要 Bearer 鉴权时再配置 `CHAT_WEBHOOK_TOKEN`。
3. 复制 `.env.example` 为 `.env.local`，填写配置后重启开发服务器。部署到 Vercel 时，应在项目 Environment Variables 中填写，不能把密钥写入源码或 `NEXT_PUBLIC_*` 变量。

通知是服务端异步发送的，不会阻塞访客看到 AI 回复。QQ 个人号没有适合本场景的稳定官方推送入口，如需 QQ 通知，建议让 `CHAT_WEBHOOK_URL` 指向你自己已授权的 QQ 机器人服务。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
