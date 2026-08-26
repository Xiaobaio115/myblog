import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { ObjectId, type Db, type WithId } from "mongodb";
import { isSafeInternalHref } from "@/lib/internal-href";
import { prepareContentForStorage } from "@/lib/ai-image-output";
import type { AiMode } from "@/lib/ai-behavior-settings";

export const AI_VISITOR_COOKIE = "lqpp_ai_visitor";
export const MAX_STORED_MESSAGES = 40;

const CONVERSATION_COLLECTION = "ai_conversations";
const MAX_TITLE_LENGTH = 48;
const MAX_STORED_USER_MESSAGE_LENGTH = 6_000;
const MAX_ASSISTANT_MESSAGE_LENGTH = 16_000;
const MAX_TOTAL_CONVERSATIONS = 600;
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const ACTION_KINDS = new Set(["article", "series", "photos", "project", "travel"]);

let indexesReady: Promise<void> | null = null;

export type StoredChatAction = {
  label: string;
  href: string;
  kind: "article" | "series" | "photos" | "project" | "travel";
};

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: StoredChatAction[];
  reasoning?: string;
  imageNames?: string[];
  /** 文本/代码附件的文件名，仅用于展示 */
  fileNames?: string[];
  createdAt: string;
  /** 该条是错误提示而非模型真实回答，重新载入后不参与上下文 */
  errored?: boolean;
  /** 模型因输出上限中断，重新载入后仍可继续生成 */
  truncated?: boolean;
};

export type ConversationStoragePolicy = {
  enabled: boolean;
  retentionDays: number;
  maxPerVisitor: number;
};

export type ConversationSummary = {
  id: string;
  title: string;
  mode: AiMode;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  /** 所属项目 id，空串表示未分组 */
  projectId: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: StoredChatMessage[];
};

export type AdminConversationSummary = ConversationSummary & {
  visitorLabel: string;
};

type AiConversationDocument = {
  _id?: ObjectId;
  visitorHash: string;
  title: string;
  mode: AiMode;
  messages: StoredChatMessage[];
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  /** 所属项目。历史文档没有这个字段，读取时一律回落成空串 */
  projectId?: string;
};

type VisitorIdentity = {
  token: string;
  hash: string;
  isNew: boolean;
};

function collection(db: Db) {
  return db.collection<AiConversationDocument>(CONVERSATION_COLLECTION);
}

function parseCookie(request: Request, name: string) {
  const rawCookie = request.headers.get("cookie") || "";
  for (const item of rawCookie.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function isVisitorToken(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hashVisitorToken(token: string) {
  return createHash("sha256").update(`lqpp-ai-conversation:${token}`).digest("hex");
}

export function getVisitorIdentity(request: Request, create = false): VisitorIdentity | null {
  const existing = parseCookie(request, AI_VISITOR_COOKIE);
  if (isVisitorToken(existing)) {
    return { token: existing, hash: hashVisitorToken(existing), isNew: false };
  }
  if (!create) return null;
  const token = randomUUID();
  return { token, hash: hashVisitorToken(token), isNew: true };
}

export function attachVisitorCookie(response: Response, visitor: VisitorIdentity | null) {
  if (!visitor?.isNew) return response;
  response.headers.append(
    "Set-Cookie",
    `${AI_VISITOR_COOKIE}=${encodeURIComponent(visitor.token)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return response;
}

export function getConversationPolicy(value: {
  conversationHistoryEnabled: boolean;
  conversationRetentionDays: number;
  maxConversationsPerVisitor: number;
}): ConversationStoragePolicy {
  return {
    enabled: value.conversationHistoryEnabled,
    retentionDays: value.conversationRetentionDays,
    maxPerVisitor: value.maxConversationsPerVisitor,
  };
}

function cleanTitle(value: unknown) {
  return String(value ?? "")
    .replace(/[`#>*_[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

function createTitle(messages: StoredChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content || "";
  return cleanTitle(firstUserMessage) || "新对话";
}

function normalizeActions(value: unknown): StoredChatAction[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const actions = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<StoredChatAction>;
    const label = String(candidate.label || "").trim().slice(0, 80);
    const href = String(candidate.href || "").trim().slice(0, 500);
    const kind = String(candidate.kind || "");
    if (!label || !isSafeInternalHref(href) || !ACTION_KINDS.has(kind)) return [];
    return [{ label, href, kind: kind as StoredChatAction["kind"] }];
  }).slice(0, 6);
  return actions.length > 0 ? actions : undefined;
}

export function normalizeStoredMessages(value: unknown, maxUserMessageLength: number) {
  if (!Array.isArray(value)) return [];

  return value.slice(-MAX_STORED_MESSAGES).flatMap((item): StoredChatMessage[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<StoredChatMessage>;
    if (candidate.role !== "user" && candidate.role !== "assistant") return [];
    const maxLength = candidate.role === "user"
      ? Math.min(MAX_STORED_USER_MESSAGE_LENGTH, Math.max(50, maxUserMessageLength))
      : MAX_ASSISTANT_MESSAGE_LENGTH;
    // 先处理内联图片再截断：base64 被从中间切断就是一张坏图，
    // 而且断的位置在正文里看不出来。理由详见 prepareContentForStorage。
    const content = prepareContentForStorage(String(candidate.content || ""), maxLength)
      .slice(0, maxLength);
    if (!content.trim()) return [];
    const parsedDate = new Date(String(candidate.createdAt || ""));
    const createdAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const id = /^[\w-]{1,80}$/.test(String(candidate.id || ""))
      ? String(candidate.id)
      : randomUUID();

    return [{
      id,
      role: candidate.role,
      content,
      actions: candidate.role === "assistant" ? normalizeActions(candidate.actions) : undefined,
      reasoning: candidate.role === "assistant" && typeof candidate.reasoning === "string"
        ? candidate.reasoning.slice(0, 4000)
        : undefined,
      imageNames: candidate.role === "user" && Array.isArray(candidate.imageNames)
        ? candidate.imageNames.map((name) => String(name).slice(0, 120)).slice(0, 3)
        : undefined,
      fileNames: candidate.role === "user" && Array.isArray(candidate.fileNames)
        ? candidate.fileNames.map((name) => String(name).slice(0, 120)).slice(0, 3)
        : undefined,
      errored: candidate.role === "assistant" && candidate.errored === true ? true : undefined,
      truncated: candidate.role === "assistant" && candidate.truncated === true ? true : undefined,
      createdAt: createdAt.toISOString(),
    }];
  });
}

function toSummary(document: WithId<AiConversationDocument>): ConversationSummary {
  return {
    id: document._id.toString(),
    title: document.title,
    mode: document.mode,
    messageCount: document.messageCount,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    expiresAt: document.expiresAt.toISOString(),
    projectId: document.projectId || "",
  };
}

function toDetail(document: WithId<AiConversationDocument>): ConversationDetail {
  return { ...toSummary(document), messages: document.messages };
}

export async function ensureConversationIndexes(db: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      collection(db).createIndex({ visitorHash: 1, updatedAt: -1 }),
      collection(db).createIndex({ updatedAt: -1 }),
      collection(db).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      // 删除项目时要把它名下的会话批量退回未分组
      collection(db).createIndex({ visitorHash: 1, projectId: 1 }),
    ]).then(() => undefined).catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

function getExpiresAt(retentionDays: number) {
  return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
}

async function pruneVisitorConversations(db: Db, visitorHash: string, maxPerVisitor: number) {
  const stale = await collection(db)
    .find({ visitorHash })
    .sort({ updatedAt: -1 })
    .skip(maxPerVisitor)
    .project({ _id: 1 })
    .toArray();
  if (stale.length > 0) {
    await collection(db).deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  }
}

async function pruneGlobalConversations(db: Db) {
  const stale = await collection(db)
    .find({})
    .sort({ updatedAt: -1 })
    .skip(MAX_TOTAL_CONVERSATIONS)
    .project({ _id: 1 })
    .toArray();
  if (stale.length > 0) {
    await collection(db).deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  }
}

export async function listVisitorConversations(db: Db, visitorHash: string) {
  await ensureConversationIndexes(db);
  const conversations = await collection(db)
    .find({ visitorHash })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
  return conversations.map(toSummary);
}

export async function createVisitorConversation(input: {
  db: Db;
  visitorHash: string;
  mode: AiMode;
  messages: unknown;
  maxUserMessageLength: number;
  policy: ConversationStoragePolicy;
  projectId?: string;
}) {
  await ensureConversationIndexes(input.db);
  const messages = normalizeStoredMessages(input.messages, input.maxUserMessageLength);
  const now = new Date();
  const document: AiConversationDocument = {
    visitorHash: input.visitorHash,
    title: createTitle(messages),
    mode: input.mode,
    messages,
    messageCount: messages.length,
    createdAt: now,
    updatedAt: now,
    expiresAt: getExpiresAt(input.policy.retentionDays),
    projectId: input.projectId || "",
  };
  const result = await collection(input.db).insertOne(document);
  await Promise.all([
    pruneVisitorConversations(input.db, input.visitorHash, input.policy.maxPerVisitor),
    pruneGlobalConversations(input.db),
  ]);
  return toDetail({ ...document, _id: result.insertedId });
}

export async function getVisitorConversation(db: Db, id: string, visitorHash: string) {
  if (!ObjectId.isValid(id)) return null;
  await ensureConversationIndexes(db);
  const document = await collection(db).findOne({ _id: new ObjectId(id), visitorHash });
  return document ? toDetail(document) : null;
}

export async function updateVisitorConversation(input: {
  db: Db;
  id: string;
  visitorHash: string;
  mode: AiMode;
  messages: unknown;
  maxUserMessageLength: number;
  retentionDays: number;
  /** undefined 表示不改动归属；空串表示移出项目 */
  projectId?: string;
}) {
  if (!ObjectId.isValid(input.id)) return null;
  await ensureConversationIndexes(input.db);
  const messages = normalizeStoredMessages(input.messages, input.maxUserMessageLength);
  const now = new Date();
  const document = await collection(input.db).findOneAndUpdate(
    { _id: new ObjectId(input.id), visitorHash: input.visitorHash },
    {
      $set: {
        title: createTitle(messages),
        mode: input.mode,
        messages,
        messageCount: messages.length,
        updatedAt: now,
        expiresAt: getExpiresAt(input.retentionDays),
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      },
    },
    { returnDocument: "after" }
  );
  return document ? toDetail(document) : null;
}

/** 只改归属，不动消息内容。用于「移入项目 / 移出项目」。 */
export async function setVisitorConversationProject(input: {
  db: Db;
  id: string;
  visitorHash: string;
  projectId: string;
}) {
  if (!ObjectId.isValid(input.id)) return null;
  await ensureConversationIndexes(input.db);
  const document = await collection(input.db).findOneAndUpdate(
    { _id: new ObjectId(input.id), visitorHash: input.visitorHash },
    { $set: { projectId: input.projectId, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return document ? toSummary(document) : null;
}

/**
 * 把某个项目名下的会话全部退回未分组。
 *
 * 删除项目时调用。不删会话本身——那是用户的真实产出，
 * 而项目只是它的分组容器。
 */
export async function detachVisitorConversationsFromProject(input: {
  db: Db;
  visitorHash: string;
  projectId: string;
}) {
  await ensureConversationIndexes(input.db);
  const result = await collection(input.db).updateMany(
    { visitorHash: input.visitorHash, projectId: input.projectId },
    { $set: { projectId: "" } }
  );
  return result.modifiedCount;
}

export async function deleteVisitorConversation(db: Db, id: string, visitorHash: string) {
  if (!ObjectId.isValid(id)) return false;
  const result = await collection(db).deleteOne({ _id: new ObjectId(id), visitorHash });
  return result.deletedCount > 0;
}

/*
  这里原来有 deleteAllVisitorConversations，随「一次清空全部」的接口一并删除。
  站长清理访客会话用 deleteAllAdminConversations，那条路径需要密码。
  留着一个没人调用的批量删除导出，迟早会被当成现成工具再接上去。
*/

export async function listAdminConversations(db: Db, limit = 100) {
  await ensureConversationIndexes(db);
  const conversations = await collection(db)
    .find({})
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .toArray();
  return conversations.map((document): AdminConversationSummary => ({
    ...toSummary(document),
    visitorLabel: document.visitorHash.slice(0, 10),
  }));
}

export async function getAdminConversation(db: Db, id: string) {
  if (!ObjectId.isValid(id)) return null;
  await ensureConversationIndexes(db);
  const document = await collection(db).findOne({ _id: new ObjectId(id) });
  return document ? { ...toDetail(document), visitorLabel: document.visitorHash.slice(0, 10) } : null;
}

export async function countAdminConversations(db: Db) {
  return collection(db).countDocuments({});
}

export async function deleteAdminConversation(db: Db, id: string) {
  if (!ObjectId.isValid(id)) return false;
  const result = await collection(db).deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

export async function deleteAllAdminConversations(db: Db) {
  const result = await collection(db).deleteMany({});
  return result.deletedCount;
}
