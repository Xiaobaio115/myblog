import "server-only";

import { getEffectiveChatNotificationSettings } from "@/lib/chat-notification-settings";

type ChatNotification = {
  message: string;
  pageUrl?: string;
  userAgent?: string;
};

const NOTIFICATION_TIMEOUT_MS = 8_000;

function formatNotification({ message, pageUrl, userAgent }: ChatNotification) {
  const receivedAt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date());
  let safePageUrl = "";

  if (pageUrl) {
    try {
      const url = new URL(pageUrl);
      safePageUrl = `${url.origin}${url.pathname}`;
    } catch {
      safePageUrl = "";
    }
  }

  return [
    `### 访客消息\n\n${message}`,
    `- 时间：${receivedAt}`,
    safePageUrl ? `- 页面：${safePageUrl}` : "",
    userAgent ? `- 设备：${userAgent.slice(0, 180)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function postWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOTIFICATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendServerChan(notification: ChatNotification, sendKey: string) {
  const body = new URLSearchParams({
    title: "博客收到一条新的聊天消息",
    desp: formatNotification(notification),
  });

  const response = await postWithTimeout(
    `https://sctapi.ftqq.com/${encodeURIComponent(sendKey)}.send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    }
  );
  const result = (await response.json().catch(() => null)) as {
    code?: number;
    message?: string;
  } | null;

  if (result && typeof result.code === "number" && result.code !== 0) {
    throw new Error(result.message || `Server酱返回错误码 ${result.code}`);
  }
}

async function sendGenericWebhook(
  notification: ChatNotification,
  webhookUrl: string,
  token: string,
) {
  await postWithTimeout(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      event: "blog.chat.message",
      title: "博客收到一条新的聊天消息",
      text: notification.message,
      markdown: formatNotification(notification),
      pageUrl: notification.pageUrl || null,
      userAgent: notification.userAgent || null,
      createdAt: new Date().toISOString(),
    }),
  });
}

async function dispatchChatNotification(
  notification: ChatNotification,
  throwOnFailure = false,
) {
  const {
    serverChanSendKey,
    webhookUrl,
    webhookToken,
  } = await getEffectiveChatNotificationSettings();
  const tasks: Promise<void>[] = [];

  if (serverChanSendKey) {
    tasks.push(sendServerChan(notification, serverChanSendKey));
  }

  if (webhookUrl) {
    tasks.push(sendGenericWebhook(notification, webhookUrl, webhookToken));
  }

  if (tasks.length === 0) {
    return;
  }

  const results = await Promise.allSettled(tasks);
  const failures = results.filter((result) => result.status === "rejected");
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Chat notification failed:", result.reason);
    }
  });

  if (throwOnFailure && failures.length > 0) {
    throw new Error("通知服务返回失败，请检查密钥、Webhook 地址和服务端日志。");
  }
}

export async function notifyOwnerOfChatMessage(notification: ChatNotification) {
  await dispatchChatNotification(notification);
}

export async function sendChatNotificationTest() {
  const settings = await getEffectiveChatNotificationSettings();
  if (!settings.serverChanSendKey && !settings.webhookUrl) {
    throw new Error("请先配置 Server酱或通用 Webhook。");
  }

  await dispatchChatNotification(
    {
      message: "这是一条来自博客后台的聊天通知测试消息。",
      pageUrl: "https://example.invalid/admin/chat-notifications",
      userAgent: "LQPP Admin Test",
    },
    true,
  );
}
