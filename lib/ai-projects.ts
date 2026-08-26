import "server-only";

import { ObjectId, type Db } from "mongodb";
import { randomUUID } from "node:crypto";
import {
  buildProjectFileContext,
  buildProjectInstructionContext,
  canCreateProject,
  countProjectFileChars,
  normalizeProjectFiles,
  normalizeProjectInstructions,
  normalizeProjectName,
  type ProjectFile,
} from "@/lib/ai-project-context";
import type { ConversationGroup } from "@/lib/ai-conversation-groups";

const PROJECT_COLLECTION = "ai_projects";

let indexesReady: Promise<void> | null = null;

/**
 * 项目归属。
 *
 * 访客组必须带 visitorHash；开发者组只有站长一个人，用空串占位。
 * 两组共用一个集合，靠 group 判别——分两个集合会让所有 CRUD 都写两遍。
 */
export type ProjectOwner =
  | { group: "visitor"; visitorHash: string }
  | { group: "developer" };

export type ProjectSummary = {
  id: string;
  name: string;
  instructions: string;
  fileCount: number;
  fileChars: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectSummary & {
  files: ProjectFile[];
};

type AiProjectDocument = {
  _id?: ObjectId;
  group: ConversationGroup;
  visitorHash: string;
  name: string;
  instructions: string;
  files: ProjectFile[];
  createdAt: Date;
  updatedAt: Date;
  /**
   * 仅访客组有值。开发者组不写这个字段，因此 TTL 索引不会碰它——
   * MongoDB 的 TTL 只删除该字段为 Date 的文档，字段缺失或为 null 的一概跳过。
   * 这正是两组共用一个集合还能有不同生命周期的原因。
   */
  expiresAt?: Date;
};

function collection(db: Db) {
  return db.collection<AiProjectDocument>(PROJECT_COLLECTION);
}

function ownerFilter(owner: ProjectOwner) {
  return owner.group === "visitor"
    ? { group: "visitor" as const, visitorHash: owner.visitorHash }
    : { group: "developer" as const };
}

export async function ensureProjectIndexes(db: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      collection(db).createIndex({ group: 1, visitorHash: 1, updatedAt: -1 }),
      collection(db).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined).catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

function toSummary(document: AiProjectDocument & { _id: ObjectId }): ProjectSummary {
  return {
    id: document._id.toHexString(),
    name: document.name,
    instructions: document.instructions || "",
    fileCount: document.files?.length || 0,
    fileChars: countProjectFileChars(document.files || []),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toDetail(document: AiProjectDocument & { _id: ObjectId }): ProjectDetail {
  return { ...toSummary(document), files: document.files || [] };
}

/**
 * 访客项目的过期时间按「最后一次动过」顺延。
 *
 * 用滑动过期而不是固定过期：项目是设定的容器而不是聊天记录本身，
 * 一直在用的项目不该因为建得早就被清掉；彻底不用了才随访客数据一起过期。
 */
function nextExpiresAt(owner: ProjectOwner, retentionDays: number): Date | undefined {
  if (owner.group !== "visitor") return undefined;
  return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
}

export async function listProjects(db: Db, owner: ProjectOwner) {
  await ensureProjectIndexes(db);
  const documents = await collection(db)
    .find(ownerFilter(owner))
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
  return documents.map(toSummary);
}

export async function countProjects(db: Db, owner: ProjectOwner) {
  await ensureProjectIndexes(db);
  return collection(db).countDocuments(ownerFilter(owner));
}

export async function getProject(db: Db, id: string, owner: ProjectOwner) {
  if (!ObjectId.isValid(id)) return null;
  await ensureProjectIndexes(db);
  const document = await collection(db).findOne({ _id: new ObjectId(id), ...ownerFilter(owner) });
  return document ? toDetail(document) : null;
}

export async function createProject(input: {
  db: Db;
  owner: ProjectOwner;
  name: unknown;
  instructions?: unknown;
  files?: unknown;
  retentionDays: number;
}): Promise<{ project: ProjectDetail | null; error: string }> {
  await ensureProjectIndexes(input.db);
  const name = normalizeProjectName(input.name);
  if (!name) return { project: null, error: "请填写项目名称。" };

  const quota = canCreateProject(await countProjects(input.db, input.owner));
  if (!quota.ok) return { project: null, error: quota.error };

  const normalizedFiles = normalizeProjectFiles(input.files);
  if (normalizedFiles.error) return { project: null, error: normalizedFiles.error };

  const now = new Date();
  const expiresAt = nextExpiresAt(input.owner, input.retentionDays);
  const document: AiProjectDocument = {
    group: input.owner.group,
    visitorHash: input.owner.group === "visitor" ? input.owner.visitorHash : "",
    name,
    instructions: normalizeProjectInstructions(input.instructions),
    files: normalizedFiles.files.map((file) => ({ ...file, id: file.id || randomUUID() })),
    createdAt: now,
    updatedAt: now,
    ...(expiresAt ? { expiresAt } : {}),
  };
  const result = await collection(input.db).insertOne(document);
  return { project: toDetail({ ...document, _id: result.insertedId }), error: "" };
}

/**
 * 更新项目。只更新传入的字段。
 *
 * name / instructions / files 三者都用 undefined 表示「不动」，
 * 因为空字符串和空数组都是合法的目标值（清空指令、删掉所有文件）。
 */
export async function updateProject(input: {
  db: Db;
  id: string;
  owner: ProjectOwner;
  name?: unknown;
  instructions?: unknown;
  files?: unknown;
  retentionDays: number;
}): Promise<{ project: ProjectDetail | null; error: string }> {
  if (!ObjectId.isValid(input.id)) return { project: null, error: "项目不存在。" };
  await ensureProjectIndexes(input.db);

  const updates: Partial<AiProjectDocument> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    const name = normalizeProjectName(input.name);
    if (!name) return { project: null, error: "请填写项目名称。" };
    updates.name = name;
  }
  if (input.instructions !== undefined) {
    updates.instructions = normalizeProjectInstructions(input.instructions);
  }
  if (input.files !== undefined) {
    const normalizedFiles = normalizeProjectFiles(input.files);
    if (normalizedFiles.error) return { project: null, error: normalizedFiles.error };
    updates.files = normalizedFiles.files.map((file) => ({ ...file, id: file.id || randomUUID() }));
  }
  const expiresAt = nextExpiresAt(input.owner, input.retentionDays);
  if (expiresAt) updates.expiresAt = expiresAt;

  const document = await collection(input.db).findOneAndUpdate(
    { _id: new ObjectId(input.id), ...ownerFilter(input.owner) },
    { $set: updates },
    { returnDocument: "after" }
  );
  return document
    ? { project: toDetail(document), error: "" }
    : { project: null, error: "项目不存在。" };
}

/**
 * 删除项目。
 *
 * 不连带删除项目里的会话：会话是用户的真实产出，项目只是它的分组容器。
 * 删项目时把会话退回「未分组」，比静默删掉几十条对话安全得多。
 * 调用方负责清理会话上的 projectId（见 detachConversationsFromProject）。
 */
export async function deleteProject(db: Db, id: string, owner: ProjectOwner) {
  if (!ObjectId.isValid(id)) return false;
  await ensureProjectIndexes(db);
  const result = await collection(db).deleteOne({ _id: new ObjectId(id), ...ownerFilter(owner) });
  return result.deletedCount > 0;
}

/**
 * 取出项目要注入对话的两段上下文。
 *
 * 返回分开的两段而不是拼好的一段，是为了让 resolveHistoryBudget 能分别计入开销，
 * 也方便调用方决定注入顺序。
 */
export async function getProjectInjection(db: Db, id: string, owner: ProjectOwner) {
  const project = await getProject(db, id, owner);
  if (!project) return { instructionContext: "", fileContext: "", name: "" };
  return {
    instructionContext: buildProjectInstructionContext(project.instructions, owner.group),
    fileContext: buildProjectFileContext(project.files),
    name: project.name,
  };
}
