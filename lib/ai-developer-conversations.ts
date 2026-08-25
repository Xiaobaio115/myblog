import "server-only";

import { ObjectId, type Db, type WithId } from "mongodb";

const CONVERSATION_COLLECTION = "ai_developer_conversations";
const MESSAGE_COLLECTION = "ai_developer_messages";
const MAX_TITLE_LENGTH = 64;
const MAX_MESSAGE_LENGTH = 1_000_000;
const MAX_REASONING_LENGTH = 500_000;
/**
 * 自定义指令上限。这段文本每轮都会作为 system 消息发出去，
 * 放太长等于持续占用上下文预算，4000 字足够写清角色和输出要求。
 */
const MAX_INSTRUCTIONS_LENGTH = 4000;

let indexesReady: Promise<void> | null = null;

export type DeveloperChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  imageNames?: string[];
  fileNames?: string[];
  createdAt: string;
  /** 该条是错误提示而非模型真实回答，重新载入后不参与上下文 */
  errored?: boolean;
  /** 模型因输出上限中断，重新载入后仍可继续生成 */
  truncated?: boolean;
};

export type DeveloperConversationSummary = {
  id: string;
  title: string;
  modelId: string;
  mode: "technical";
  /** 会话级自定义指令，每轮以 system 消息注入 */
  instructions: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: "";
};

export type DeveloperConversationDetail = DeveloperConversationSummary & {
  messages: DeveloperChatMessage[];
};

type DeveloperConversationDocument = {
  _id?: ObjectId;
  title: string;
  modelId: string;
  instructions?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type DeveloperMessageDocument = {
  _id?: ObjectId;
  conversationId: ObjectId;
  messageId: string;
  position: number;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  imageNames?: string[];
  fileNames?: string[];
  errored?: boolean;
  truncated?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function conversations(db: Db) {
  return db.collection<DeveloperConversationDocument>(CONVERSATION_COLLECTION);
}

function messages(db: Db) {
  return db.collection<DeveloperMessageDocument>(MESSAGE_COLLECTION);
}

export async function ensureDeveloperConversationIndexes(db: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      conversations(db).createIndex({ updatedAt: -1 }),
      messages(db).createIndex({ conversationId: 1, position: 1 }),
      messages(db).createIndex({ conversationId: 1, messageId: 1 }, { unique: true }),
    ]).then(() => undefined).catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

export function normalizeInstructions(value: unknown) {
  return typeof value === "string" ? value.slice(0, MAX_INSTRUCTIONS_LENGTH).trim() : "";
}

function cleanTitle(value: unknown) {
  return String(value || "")
    .replace(/[`#>*_[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

function normalizeDeveloperMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, position): Array<DeveloperChatMessage & { position: number }> => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<DeveloperChatMessage>;
    if (candidate.role !== "user" && candidate.role !== "assistant") return [];
    const content = String(candidate.content || "").slice(0, MAX_MESSAGE_LENGTH);
    if (!content.trim()) return [];
    const parsedDate = new Date(String(candidate.createdAt || ""));
    const createdAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const rawId = String(candidate.id || "");
    const id = /^[\w-]{1,100}$/.test(rawId) ? rawId : new ObjectId().toHexString();
    return [{
      id,
      role: candidate.role,
      content,
      reasoning: candidate.role === "assistant" && typeof candidate.reasoning === "string"
        ? candidate.reasoning.slice(0, MAX_REASONING_LENGTH)
        : undefined,
      imageNames: candidate.role === "user" && Array.isArray(candidate.imageNames)
        ? candidate.imageNames.map((name) => String(name).slice(0, 160)).slice(0, 3)
        : undefined,
      fileNames: candidate.role === "user" && Array.isArray(candidate.fileNames)
        ? candidate.fileNames.map((name) => String(name).slice(0, 160)).slice(0, 3)
        : undefined,
      errored: candidate.role === "assistant" && candidate.errored === true ? true : undefined,
      truncated: candidate.role === "assistant" && candidate.truncated === true ? true : undefined,
      createdAt: createdAt.toISOString(),
      position,
    }];
  });
}

function toSummary(document: WithId<DeveloperConversationDocument>): DeveloperConversationSummary {
  return {
    id: document._id.toHexString(),
    title: document.title,
    modelId: document.modelId,
    mode: "technical",
    instructions: document.instructions || "",
    messageCount: document.messageCount,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    expiresAt: "",
  };
}

async function saveMessages(
  db: Db,
  conversationId: ObjectId,
  input: unknown
) {
  const normalized = normalizeDeveloperMessages(input);
  if (normalized.length === 0) return 0;
  const now = new Date();
  await messages(db).bulkWrite(normalized.map((message) => ({
    updateOne: {
      filter: { conversationId, messageId: message.id },
      update: {
        $set: {
          conversationId,
          messageId: message.id,
          position: message.position,
          role: message.role,
          content: message.content,
          reasoning: message.reasoning,
          imageNames: message.imageNames,
          fileNames: message.fileNames,
          errored: message.errored,
          truncated: message.truncated,
          createdAt: new Date(message.createdAt),
          updatedAt: now,
        },
      },
      upsert: true,
    },
  })));
  return messages(db).countDocuments({ conversationId });
}

/**
 * 列出开发者会话。
 *
 * limit 默认不设：前台 AI 页的侧边栏要能看到全部历史，
 * 这是给管理员一个人用的集合，条数天然有限。后台管理页会显式传上限。
 */
export async function listDeveloperConversations(db: Db, limit?: number) {
  await ensureDeveloperConversationIndexes(db);
  const query = conversations(db).find({}).sort({ updatedAt: -1 });
  if (typeof limit === "number") query.limit(Math.min(Math.max(Math.floor(limit), 1), 200));
  const result = await query.toArray();
  return result.map(toSummary);
}

export async function countDeveloperConversations(db: Db) {
  return conversations(db).countDocuments({});
}

export async function createDeveloperConversation(input: {
  db: Db;
  modelId: string;
  instructions?: unknown;
  messages: unknown;
}) {
  await ensureDeveloperConversationIndexes(input.db);
  const normalized = normalizeDeveloperMessages(input.messages);
  const firstUserMessage = normalized.find((message) => message.role === "user")?.content || "";
  const now = new Date();
  const document: DeveloperConversationDocument = {
    title: cleanTitle(firstUserMessage) || "新对话",
    modelId: String(input.modelId || "").slice(0, 200),
    instructions: normalizeInstructions(input.instructions),
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const inserted = await conversations(input.db).insertOne(document);
  const messageCount = await saveMessages(input.db, inserted.insertedId, normalized);
  await conversations(input.db).updateOne({ _id: inserted.insertedId }, { $set: { messageCount } });
  return getDeveloperConversation(input.db, inserted.insertedId.toHexString());
}

export async function getDeveloperConversation(db: Db, id: string) {
  if (!ObjectId.isValid(id)) return null;
  await ensureDeveloperConversationIndexes(db);
  const conversationId = new ObjectId(id);
  const document = await conversations(db).findOne({ _id: conversationId });
  if (!document) return null;
  const storedMessages = await messages(db)
    .find({ conversationId })
    .sort({ position: 1, createdAt: 1 })
    .toArray();
  return {
    ...toSummary(document),
    messages: storedMessages.map((message): DeveloperChatMessage => ({
      id: message.messageId,
      role: message.role,
      content: message.content,
      reasoning: message.reasoning,
      imageNames: message.imageNames,
      fileNames: message.fileNames,
      errored: message.errored,
      truncated: message.truncated,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function updateDeveloperConversation(input: {
  db: Db;
  id: string;
  modelId: string;
  instructions?: unknown;
  messages: unknown;
}) {
  if (!ObjectId.isValid(input.id)) return null;
  await ensureDeveloperConversationIndexes(input.db);
  const conversationId = new ObjectId(input.id);
  const existing = await conversations(input.db).findOne({ _id: conversationId });
  if (!existing) return null;
  const normalized = normalizeDeveloperMessages(input.messages);
  const firstUserMessage = normalized.find((message) => message.role === "user")?.content || "";
  const messageCount = await saveMessages(input.db, conversationId, normalized);
  await conversations(input.db).updateOne(
    { _id: conversationId },
    {
      $set: {
        title: cleanTitle(firstUserMessage) || existing.title,
        modelId: String(input.modelId || existing.modelId).slice(0, 200),
        // 区分「没传」和「传了空串」：前者保留原值，后者是用户主动清空指令。
        instructions: input.instructions === undefined
          ? (existing.instructions || "")
          : normalizeInstructions(input.instructions),
        messageCount,
        updatedAt: new Date(),
      },
    }
  );
  return getDeveloperConversation(input.db, input.id);
}

export async function deleteDeveloperConversation(db: Db, id: string) {
  if (!ObjectId.isValid(id)) return false;
  const conversationId = new ObjectId(id);
  const result = await conversations(db).deleteOne({ _id: conversationId });
  if (result.deletedCount > 0) await messages(db).deleteMany({ conversationId });
  return result.deletedCount > 0;
}

export async function deleteAllDeveloperConversations(db: Db) {
  const [conversationResult] = await Promise.all([
    conversations(db).deleteMany({}),
    messages(db).deleteMany({}),
  ]);
  return conversationResult.deletedCount;
}
