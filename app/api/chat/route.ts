import { after, NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { resolveProjectOwner } from "@/lib/ai-project-owner";
import { orderInstructionTexts } from "@/lib/ai-project-context";
import { getProjectInjection } from "@/lib/ai-projects";
import { notifyOwnerOfChatMessage } from "@/lib/chat-notify";
import { getAiBehavior, getAiModePrompt, type AiMode } from "@/lib/ai-behavior-settings";
import { buildAiContentContext, type ChatAction } from "@/lib/ai-content-tools";
import { composeAiSystemPrompt } from "@/lib/ai-prompt";
import { getPublicAiModels, resolveAiModel } from "@/lib/ai-provider-settings";
import { readSseEvents } from "@/lib/ai-sse";
import { verifyAdminRequest } from "@/lib/admin-session";
import { describeFailure, type ProviderFailure } from "@/lib/ai-error-messages";
import {
  buildAttachmentContext,
  normalizeAttachments,
  normalizeImages,
} from "@/lib/ai-attachments";
import {
  planContextCompression,
  renderTranscriptForSummary,
  resolveHistoryBudget,
  SUMMARY_SYSTEM_PROMPT,
  wrapSummaryAsContext,
} from "@/lib/ai-context-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "auto" } }
  >;
};

type IncomingChatMessage = {
  role?: unknown;
  content?: unknown;
};

type SseEventName = "meta" | "status" | "reasoning" | "content" | "image" | "done" | "error";

const DEVELOPER_MAX_MESSAGE_LENGTH = 1_000_000;

function getDailyLimit(configuredLimit: number) {
  const envValue = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(envValue) && envValue > 0 ? envValue : configuredLimit;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 从供应商错误响应体里取出人类可读的原因。
 * 兼容 OpenAI 风格 { error: { message } }、{ error: "..." } 与 { message: "..." }；
 * 解析不出结构时退回截断后的纯文本，避免把整段 HTML 报错页塞给用户。
 */
function extractProviderErrorMessage(raw: string) {
  const text = raw.trim();
  if (!text) return "";
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) {
      const errorField = parsed.error;
      if (typeof errorField === "string" && errorField.trim()) return errorField.trim().slice(0, 300);
      if (isRecord(errorField) && typeof errorField.message === "string" && errorField.message.trim()) {
        return errorField.message.trim().slice(0, 300);
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message.trim().slice(0, 300);
      }
    }
  } catch {
    // 非 JSON 响应，走下方纯文本兜底
  }
  if (text.startsWith("<")) return "";
  return text.replace(/\s+/g, " ").slice(0, 300);
}

function getLocalReply(text: string) {
  const message = text.trim().toLowerCase();

  if (!message) return "你可以问我文章、相册、3D 照片墙，或者后台入口在哪里。";

  if (["你好", "hi", "hello", "在吗"].some((word) => message.includes(word))) {
    return "你好呀，我是甘蔗。可以陪你逛逛这个博客，也可以帮你快速找到文章、相册和旅行地图。";
  }

  if (message.includes("相册") || message.includes("照片") || message.includes("photo")) {
    return "相册页可以浏览照片，也可以进入 3D 星空相册，用更沉浸的方式看照片墙。";
  }

  if (message.includes("3d") || message.includes("星空")) {
    return "3D 星空相册在相册页面可以进入，它会把上传的照片放进一个可旋转的星空照片墙。";
  }

  if (message.includes("后台") || message.includes("管理") || message.includes("上传")) {
    return "后台入口是 /admin。登录后可以管理文章、照片、留言和站点内容。";
  }

  if (message.includes("旅行") || message.includes("地图")) {
    return "旅行地图在“我的世界”里，可以用 3D 中国地图查看走过的城市和照片记录。";
  }

  return "";
}

function addChatMetadata(headers: Headers, actions: ChatAction[], mode?: AiMode) {
  if (actions.length > 0) {
    headers.set("X-Chat-Actions", encodeURIComponent(JSON.stringify(actions)));
  }
  if (mode) headers.set("X-Chat-Mode", mode);
}

function encodeSseEvent(event: SseEventName, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamLocalText(
  text: string,
  actions: ChatAction[] = [],
  mode?: AiMode,
  options: { sse?: boolean; modelId?: string } = {}
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (options.sse) {
        controller.enqueue(encoder.encode(encodeSseEvent("meta", { actions, mode, modelId: options.modelId || "" })));
        controller.enqueue(encoder.encode(encodeSseEvent("content", { delta: text })));
        controller.enqueue(encoder.encode(encodeSseEvent("done", {})));
      } else {
        controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  const headers = new Headers({
    "Content-Type": options.sse ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  });
  addChatMetadata(headers, actions, mode);
  return new Response(stream, { headers });
}

function getPagePath(pageUrl: string | undefined) {
  if (!pageUrl) return "";
  try {
    const url = new URL(pageUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.pathname : "";
  } catch {
    return "";
  }
}

async function checkDailyLimit(request: Request, configuredLimit: number) {
  const dailyLimit = getDailyLimit(configuredLimit);
  const ip = getClientIp(request);
  const key = `${getTodayKey()}::${ip}`;

  try {
    const db = await getDb();
    const result = await db.collection("ai_usage").findOneAndUpdate(
      { key },
      {
        $setOnInsert: { key, ip, day: getTodayKey(), createdAt: new Date() },
        $inc: { count: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, returnDocument: "after" }
    );

    const count = Number(result?.count ?? 0);
    return { allowed: count <= dailyLimit, dailyLimit };
  } catch {
    return { allowed: true, dailyLimit };
  }
}

function normalizeIncomingMessages(value: unknown): IncomingChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message) => {
    if (!isRecord(message)) return [];
    if (message.role !== "user" && message.role !== "assistant") return [];
    if (typeof message.content !== "string") return [];
    return [{ role: message.role, content: message.content }];
  });
}

function normalizeMessages(
  messages: IncomingChatMessage[],
  maxHistory: number,
  maxLength: number,
  images: string[] = []
) {
  const normalized = messages.slice(-maxHistory).map<ChatMessage>((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "").slice(0, maxLength),
  }));
  if (images.length > 0) {
    const lastUserIndex = normalized.findLastIndex((message) => message.role === "user");
    if (lastUserIndex >= 0) {
      const text = String(normalized[lastUserIndex].content || "");
      normalized[lastUserIndex] = {
        role: "user",
        content: [
          { type: "text", text },
          ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "auto" as const } })),
        ],
      };
    }
  }
  return normalized;
}

function normalizeProviderImage(value: unknown) {
  if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
  if (!value || typeof value !== "object") return "";
  const candidate = value as { url?: unknown; image_url?: { url?: unknown } | string };
  const url = typeof candidate.image_url === "string"
    ? candidate.image_url
    : candidate.image_url?.url || candidate.url;
  return typeof url === "string" && /^https:\/\//i.test(url) ? url : "";
}

function parseProviderDelta(value: unknown) {
  const json = value && typeof value === "object" ? value as {
    choices?: Array<{
      delta?: {
        content?: unknown;
        reasoning_content?: unknown;
        reasoning?: unknown;
        thinking?: unknown;
        images?: unknown;
      };
      finish_reason?: unknown;
    }>;
  } : {};
  const choice = json.choices?.[0];
  const delta = choice?.delta || {};
  // 供应商用 finish_reason 说明本次生成为何结束：length 表示撞上 max_tokens 被截断。
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : "";
  let content = "";
  const images: string[] = [];

  if (typeof delta.content === "string") {
    content = delta.content;
  } else if (Array.isArray(delta.content)) {
    for (const part of delta.content) {
      if (!part || typeof part !== "object") continue;
      const typedPart = part as { type?: unknown; text?: unknown; image_url?: unknown; url?: unknown };
      if (typedPart.type === "text" && typeof typedPart.text === "string") content += typedPart.text;
      const image = normalizeProviderImage(typedPart.image_url || typedPart.url);
      if (image) images.push(image);
    }
  }

  const reasoningValue = delta.reasoning_content ?? delta.reasoning ?? delta.thinking;
  const reasoning = typeof reasoningValue === "string" ? reasoningValue : "";
  if (Array.isArray(delta.images)) {
    for (const imageValue of delta.images) {
      const image = normalizeProviderImage(imageValue);
      if (image) images.push(image);
    }
  }
  return { content, reasoning, images: Array.from(new Set(images)).slice(0, 4), finishReason };
}

export async function POST(request: Request) {
  // 提到 try 外面：外层 catch 也要按身份决定说多少，
  // 而 err.message 可能带着主机名、端点地址或驱动细节。默认按访客处理。
  let developerMode = false;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "请求内容过大，图片请控制在 8MB 以内。" }, { status: 413 });
    }
    let parsedBody: unknown;
    try {
      parsedBody = await request.json();
    } catch {
      return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
    }
    if (!isRecord(parsedBody)) {
      return NextResponse.json({ error: "请求内容格式不正确。" }, { status: 400 });
    }
    const body = parsedBody;
    developerMode = body.developerMode === true;
    if (developerMode && !verifyAdminRequest(request)) {
      return NextResponse.json({ error: "管理员身份已失效，请重新登录。" }, { status: 401 });
    }
    const behavior = await getAiBehavior();
    const rawMessages = normalizeIncomingMessages(body.messages);
    const lastUserMessage = rawMessages.filter((message) => message.role === "user").at(-1);
    const userText = String(lastUserMessage?.content || "").trim();
    const wantsSse = body.responseFormat === "sse";
    const normalizedImages = normalizeImages(body.images);
    const images = normalizedImages.images;
    const normalizedAttachments = normalizeAttachments(body.attachments);

    if (!userText) {
      return NextResponse.json({ error: "消息不能为空。" }, { status: 400 });
    }

    const maxMessageLength = developerMode ? DEVELOPER_MAX_MESSAGE_LENGTH : behavior.maxMessageLength;
    if (userText.length > maxMessageLength) {
      return NextResponse.json(
        { error: `单条消息太长了，请控制在 ${maxMessageLength} 字以内。` },
        { status: 400 }
      );
    }

    if (normalizedImages.error) {
      return NextResponse.json({ error: normalizedImages.error }, { status: 400 });
    }

    if (normalizedAttachments.error) {
      return NextResponse.json({ error: normalizedAttachments.error }, { status: 400 });
    }
    const attachmentContext = buildAttachmentContext(normalizedAttachments.attachments);

    if (!developerMode) {
      const limit = await checkDailyLimit(request, behavior.dailyLimit);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: `今天聊天次数已经用完了。每位访客每天最多 ${limit.dailyLimit} 次。` },
          { status: 429 }
        );
      }
    }

    const pageUrl =
      typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 500) : undefined;
    const isWorkspace = body.surface === "workspace";
    const requestedMode = typeof body.mode === "string" ? body.mode : "";
    const activeMode = behavior.enabledModes.includes(requestedMode as AiMode)
      ? requestedMode as AiMode
      : behavior.mode;
    const selectedModel = await resolveAiModel(typeof body.modelId === "string" ? body.modelId : undefined);
    if (images.length > 0 && !selectedModel?.supportsVision) {
      return NextResponse.json({ error: "当前模型未开启图片理解能力，请选择带“视觉”标记的模型。" }, { status: 400 });
    }
    const contentContext = !developerMode && behavior.promptControls.useSiteContext
      ? await buildAiContentContext(userText, behavior.capabilities, {
          currentPath: getPagePath(pageUrl),
          requireExplicitIntent: isWorkspace,
          requireExplicitNavigation: isWorkspace,
        })
      : {
          context: "",
          fallbackText: "",
          directReply: "",
          actions: [] as ChatAction[],
          matched: false,
          sources: [] as string[],
        };
    if (!developerMode) {
      const userAgent = request.headers.get("user-agent") || undefined;
      after(() =>
        notifyOwnerOfChatMessage({
          message: userText,
          pageUrl,
          userAgent,
        })
      );
    }

    // 带附件时不能走站内抢答/本地兜底：那些分支完全不会调用模型，
    // 用户附上的文件也就白传了。
    const hasAttachments = normalizedAttachments.attachments.length > 0;
    const skipLocalShortcut = images.length > 0 || hasAttachments;

    const textFallback = !skipLocalShortcut ? contentContext.fallbackText : "";

    if (!skipLocalShortcut && contentContext.directReply) {
      return streamLocalText(contentContext.directReply, contentContext.actions, activeMode, {
        sse: wantsSse,
        modelId: selectedModel?.id,
      });
    }

    const localReply = !developerMode && !skipLocalShortcut && behavior.promptControls.useLocalFallbacks
      ? getLocalReply(userText)
      : "";

    // 站内检索没有命中时不再抢答。过去这里会直接返回「暂时没有在站内找到…」并且
    // 完全跳过模型调用，导致「帮我生成一个…」这类正常请求被误判成站内搜索失败。
    // 现在只把「未找到站内内容」作为提示写进上下文，交给模型正常回答。

    const apiKey = selectedModel?.apiKey || "";
    const baseUrl = selectedModel?.baseUrl || "";
    const model = selectedModel?.model || "";

    // 模型三要素缺失属于配置问题，必须明确暴露：过去这里会退回站内检索文案，
    // 导致「模型没配好」被伪装成「站内没搜到内容」，无法定位真实故障。
    if (!apiKey || !baseUrl || !model) {
      const missing = [
        !baseUrl ? "API Base URL" : "",
        !apiKey ? "API Key" : "",
        !model ? "模型名称" : "",
      ].filter(Boolean);
      console.error("AI provider config incomplete:", {
        providerId: selectedModel?.providerId,
        modelId: selectedModel?.id,
        missing,
      });
      return NextResponse.json(
        {
          error: describeFailure({ kind: "config_incomplete", missing }, developerMode),
          // code 本身也是诊断信息（它告诉访客「站长后台配错了」），只给开发者。
          ...(developerMode ? { code: "provider_config_incomplete" } : {}),
        },
        { status: 503 }
      );
    }

    // 站内检索未命中时，把这个事实作为上下文告知模型（而不是替模型作答），
    // 这样模型既不会编造站内不存在的内容，也能正常完成写作、问答等与站内无关的请求。
    const siteContext = developerMode
      ? [contentContext.context, attachmentContext].filter(Boolean).join("\n\n")
      : [
          contentContext.context,
          !contentContext.matched && textFallback
            ? "站内检索提示：本次没有找到与用户问题匹配的站内公开内容。请不要凭空编造站内文章、照片或项目；如果用户的请求本身与站内内容无关（例如写作、翻译、编程、闲聊），请直接正常回答。"
            : "",
          attachmentContext,
        ]
          .filter(Boolean)
          .join("\n\n");

    /**
     * 会话级自定义指令。只在后台 AI 页生效：这是管理员给单个会话设定的角色/输出要求，
     * 前台的人格统一由后台 systemPrompt 管理，不接受请求方自带指令。
     */
    const customInstructions = developerMode
      ? String(body.instructions || "").slice(0, 4000).trim()
      : "";

    /**
     * 项目级共享上下文：同一项目下的每轮对话都自动带上项目指令与项目文件。
     *
     * 归属由 Cookie 决定而不是由请求里的 projectId 决定，所以传别人的 id 只会
     * 查不到（getProjectInjection 内部按 owner 过滤），不会读到别人的项目。
     * 取不到就当没有项目：项目是增强，不该让整轮对话失败。
     */
    let projectInstructionContext = "";
    let projectFileContext = "";
    const requestedProjectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (requestedProjectId && isMongoConfigured()) {
      try {
        const owner = resolveProjectOwner(request, developerMode);
        if (owner) {
          const injection = await getProjectInjection(
            await getDb(),
            requestedProjectId,
            owner.owner
          );
          projectInstructionContext = injection.instructionContext;
          projectFileContext = injection.fileContext;
        }
      } catch (error) {
        console.error("load project injection failed:", error);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), developerMode ? 300000 : 60000);
    const systemPrompt = developerMode
      ? customInstructions
      : composeAiSystemPrompt({
          systemPrompt: behavior.systemPrompt,
          knowledgeText: behavior.knowledgeText,
          modePrompt: getAiModePrompt(activeMode, behavior.modePrompts),
          controls: behavior.promptControls,
        });

    // 顺序即优先级，规则见 orderInstructionTexts。
    const instructionTexts = orderInstructionTexts({
      sitePrompt: developerMode ? "" : systemPrompt,
      projectInstructions: projectInstructionContext,
      conversationInstructions: developerMode ? systemPrompt : "",
      group: developerMode ? "developer" : "visitor",
    });

    // 规范化 baseUrl：如果只是域名（如 https://new.xkool.cfd），自动加 /v1
    let normalizedUrl = baseUrl.replace(/\/$/, "");
    if (!normalizedUrl.includes('/v1') && !normalizedUrl.includes('/chat/completions')) {
      normalizedUrl = `${normalizedUrl}/v1`;
    }

    // 如果已包含完整路径，直接使用；否则拼接 /chat/completions
    const url = normalizedUrl.includes('/chat/completions')
      ? normalizedUrl
      : `${normalizedUrl}/chat/completions`;

    console.log("[chat] calling AI:", { originalBaseUrl: baseUrl, url, model, keyLen: apiKey?.length || 0 });

    /**
     * 上下文压缩：把早期对话交给模型压成摘要，只保留近期原文。
     *
     * 仅在后台 AI 页（developerMode）启用。前台受 maxHistoryMessages 限制，
     * 本来就不会把历史全量发出去，不需要这一步。
     *
     * 摘要失败时返回空字符串而不是抛错：压缩是优化手段，不该让它的失败
     * 连带整轮对话失败——退化成「按原样发送、可能撞窗口」仍然比直接报错好。
     */
    async function summarizeTranscript(transcript: string) {
      try {
        const response = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SUMMARY_SYSTEM_PROMPT },
              { role: "user", content: transcript },
            ],
            max_tokens: 1200,
            temperature: 0.2,
            stream: false,
          }),
        });
        if (!response.ok) {
          console.error("context summarization failed:", response.status);
          return "";
        }
        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        return typeof content === "string" ? content : "";
      } catch (error) {
        console.error("context summarization error:", error);
        return "";
      }
    }

    let historyMessages = rawMessages;
    let compressionSummary = "";
    if (developerMode) {
      // 项目指令与项目文件也占预算。漏算的话，项目一填满，留给历史的空间
      // 就会被悄悄挤掉，表现为「开了项目后 AI 突然记不住前面说过的话」。
      const historyBudget = resolveHistoryBudget(behavior.contextBudgetTokens, [
        ...instructionTexts,
        projectFileContext,
        siteContext,
      ]);
      const plan = planContextCompression(
        rawMessages.map((message) => ({
          role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(message.content || ""),
        })),
        historyBudget,
        behavior.contextVerbatimMessages
      );
      if (plan.needsCompression) {
        const summary = await summarizeTranscript(renderTranscriptForSummary(plan.toSummarize));
        // 压缩失败就按原样发送：宁可撞窗口报错，也不能静默丢掉早期上下文。
        if (summary) {
          compressionSummary = wrapSummaryAsContext(summary);
          historyMessages = rawMessages.slice(-plan.verbatim.length);
        }
      }
    }

    let aiResponse: Response;
    try {
      aiResponse = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...instructionTexts.map((content) => ({ role: "system" as const, content })),
            // 项目文件是资料而不是指令，和站内检索上下文同级，放在指令之后。
            ...(projectFileContext
              ? [{ role: "system" as const, content: projectFileContext }]
              : []),
            ...(siteContext
              ? [{ role: "system" as const, content: siteContext }]
              : []),
            ...(compressionSummary
              ? [{ role: "system" as const, content: compressionSummary }]
              : []),
            ...normalizeMessages(
              historyMessages,
              developerMode ? historyMessages.length : behavior.maxHistoryMessages,
              maxMessageLength,
              images
            ),
          ],
          ...(developerMode ? {} : {
            max_tokens: behavior.maxOutputTokens,
            temperature: behavior.temperature,
          }),
          stream: true,
        }),
      });
    } catch (error) {
      clearTimeout(timeoutId);
      const aborted = error instanceof Error && error.name === "AbortError";
      console.error("AI provider request failed:", {
        providerId: selectedModel?.providerId,
        modelId: selectedModel?.id,
        baseUrl,
        model,
        aborted,
        error,
      });
      // 固定兜底只在站长明确开启时使用，且必须声明这是离线回答，避免用户以为模型正常工作。
      if (localReply) {
        return streamLocalText(
          `${localReply}\n\n> 说明：${describeFailure(
            { kind: aborted ? "timeout" : "unreachable" },
            developerMode
          )}以上是博客内置的离线回答。`,
          contentContext.actions,
          activeMode,
          { sse: wantsSse, modelId: selectedModel?.id }
        );
      }
      return NextResponse.json(
        {
          error: describeFailure({ kind: aborted ? "timeout" : "unreachable" }, developerMode),
          ...(developerMode ? { code: aborted ? "provider_timeout" : "provider_unreachable" } : {}),
        },
        { status: 504 }
      );
    }

    if (!aiResponse.ok || !aiResponse.body) {
      clearTimeout(timeoutId);
      const errorText = await aiResponse.text().catch(() => "");
      const status = aiResponse.status;
      console.error("AI provider error:", { status, url, model, errorText: errorText.slice(0, 2000) });

      // 按供应商状态码分类。开发者拿到完整诊断，访客只知道「忙」还是「坏」——
      // 状态码、模型名、供应商原文都会暴露站点用的是哪家渠道。
      const failure: ProviderFailure = {
        kind:
          status === 401 || status === 403
            ? "auth"
            : status === 404
              ? "model_not_found"
              : status === 429
                ? "rate_limited"
                : status >= 500
                  ? "provider_server"
                  : "provider_status",
        status,
        model,
        detail: extractProviderErrorMessage(errorText),
      };

      if (localReply) {
        // 这条说明会进入「回复正文」而不是错误字段，是最容易被漏掉的泄露口。
        return streamLocalText(
          `${localReply}\n\n> 说明：${describeFailure(failure, developerMode)}以上是博客内置的离线回答。`,
          contentContext.actions,
          activeMode,
          { sse: wantsSse, modelId: selectedModel?.id }
        );
      }
      return NextResponse.json(
        {
          error: describeFailure(failure, developerMode),
          ...(developerMode ? { code: "provider_error", providerStatus: status } : {}),
        },
        { status: 502 }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = aiResponse.body.getReader();

    const stream = new ReadableStream({
      async start(streamController) {
        let buffer = "";
        const sendEvent = (event: SseEventName, data: unknown) => {
          streamController.enqueue(encoder.encode(encodeSseEvent(event, data)));
        };
        let truncatedByLimit = false;
        const processProviderData = (data: unknown) => {
          const delta = parseProviderDelta(data);
          if (delta.finishReason === "length") truncatedByLimit = true;
          if (delta.reasoning && wantsSse) sendEvent("reasoning", { delta: delta.reasoning });
          if (delta.content) {
            if (wantsSse) sendEvent("content", { delta: delta.content });
            else streamController.enqueue(encoder.encode(delta.content));
          }
          for (const imageUrl of delta.images) {
            if (wantsSse) sendEvent("image", { url: imageUrl });
            else streamController.enqueue(encoder.encode(`\n\n![AI 生成图片](${imageUrl})\n\n`));
          }
        };

        if (wantsSse) {
          sendEvent("meta", {
            actions: contentContext.actions,
            mode: developerMode ? undefined : activeMode,
            modelId: selectedModel?.id || "",
          });
          sendEvent("status", {
            phase: selectedModel?.supportsReasoning ? "thinking" : "generating",
            message: selectedModel?.supportsReasoning ? "模型正在思考" : "模型正在生成回答",
          });
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parsed = readSseEvents(buffer);
            buffer = parsed.remainder;
            parsed.events.forEach((event) => processProviderData(event.data));
          }

          buffer += decoder.decode();
          readSseEvents(buffer, { flush: true }).events.forEach((event) => processProviderData(event.data));

          // 撞上输出上限时明确告知前端，前端据此显示「继续」入口，
          // 避免用户看到一句话说到一半就停、却不知道发生了什么。
          if (wantsSse) sendEvent("done", { truncated: truncatedByLimit });
          else if (truncatedByLimit) {
            streamController.enqueue(encoder.encode("\n\n> 回答因达到输出长度上限而中断。"));
          }
          streamController.close();
        } catch (error) {
          console.error("chat stream error:", error);
          if (wantsSse) sendEvent("error", { message: "回复中断了，请稍后再试。" });
          else streamController.enqueue(encoder.encode("\n\n回复中断了，请稍后再试。"));
          streamController.close();
        } finally {
          clearTimeout(timeoutId);
        }
      },
    });

    const headers = new Headers({
      "Content-Type": wantsSse ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    });
    addChatMetadata(headers, contentContext.actions, developerMode ? undefined : activeMode);
    // 告知前端本轮压缩了多少条早期消息。压缩是静默发生的，不提示的话，
    // 用户会以为模型「忘事」，而不知道早期原文已经被换成摘要。
    if (compressionSummary) {
      headers.set("X-Chat-Compressed", String(rawMessages.length - historyMessages.length));
    }
    return new Response(stream, { headers });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : null;
    console.error("POST /api/chat error:", error);

    // err.message 是未经审查的任意文本（可能来自 fetch、MongoDB 驱动或第三方 SDK），
    // 里面常有主机名和端点地址，绝不能原样回给访客。完整内容已经写进上面的日志。
    const message = describeFailure(
      err?.name === "AbortError"
        ? { kind: "timeout" }
        : { kind: "internal", internalMessage: err?.message },
      developerMode
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const developerMode = new URL(request.url).searchParams.get("developerMode") === "1";
  if (developerMode && !verifyAdminRequest(request)) {
    return NextResponse.json({ error: "管理员身份已失效，请重新登录。" }, { status: 401 });
  }
  const [behavior, modelPool] = await Promise.all([getAiBehavior(), getPublicAiModels()]);
  return NextResponse.json(
    {
      defaultMode: behavior.mode,
      enabledModes: behavior.enabledModes,
      modes: behavior.enabledModes.map((value) => ({
        value,
        label: behavior.modeLabels[value],
      })),
      capabilities: behavior.capabilities,
      maxMessageLength: developerMode ? DEVELOPER_MAX_MESSAGE_LENGTH : behavior.maxMessageLength,
      conversationHistoryEnabled: developerMode ? true : behavior.conversationHistoryEnabled,
      developerMode,
      defaultModelId: modelPool.defaultModelId,
      models: modelPool.models,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
