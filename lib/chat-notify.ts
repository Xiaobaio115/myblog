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
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendServerChan(notification: ChatNotification, sendKey: string) {
  const body = new URLSearchParams({
    title: "博客收到一条新的聊天消息",
    desp: formatNotification(notification),
  });

  await postWithTimeout(
    `https://sctapi.ftqq.com/${encodeURIComponent(sendKey)}.send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    }
  );
}

async function sendGenericWebhook(notification: ChatNotification, webhookUrl: string) {
  const token = process.env.CHAT_WEBHOOK_TOKEN?.trim();

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

export async function notifyOwnerOfChatMessage(notification: ChatNotification) {
  const serverChanKey = process.env.SERVERCHAN_SEND_KEY?.trim();
  const webhookUrl = process.env.CHAT_WEBHOOK_URL?.trim();
  const tasks: Promise<void>[] = [];

  if (serverChanKey) {
    tasks.push(sendServerChan(notification, serverChanKey));
  }

  if (webhookUrl) {
    tasks.push(sendGenericWebhook(notification, webhookUrl));
  }

  if (tasks.length === 0) {
    return;
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Chat notification failed:", result.reason);
    }
  });
}
