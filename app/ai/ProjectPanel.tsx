"use client";

import { useCallback, useState } from "react";
import {
  MAX_PROJECT_FILE_CHARS,
  MAX_PROJECT_FILES,
  MAX_PROJECT_INSTRUCTIONS_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  MAX_PROJECT_TOTAL_CHARS,
} from "@/lib/ai-project-context";
import { isTextLikeFile, readFileAsText } from "./text-files";
import { useDialogDismiss } from "./use-dialog-dismiss";
import styles from "./ai-chat.module.css";

export type ProjectFile = { id: string; name: string; text: string; truncated: boolean };

export type ProjectSummary = {
  id: string;
  name: string;
  instructions: string;
  fileCount: number;
  fileChars: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectSummary & { files: ProjectFile[] };

/** 单个文件读入前的体积闸门，和聊天附件保持一致 */
const MAX_FILE_BYTES = 256 * 1024;

/**
 * 项目设置面板：改名、共享指令、共享文件。
 *
 * 只在打开时挂载，所以草稿状态直接用 useState 初始化即可，
 * 不需要 effect 同步 props——本仓库把 set-state-in-effect 当 error。
 */
export function ProjectPanel({
  project,
  developerMode,
  onClose,
  onSaved,
}: {
  project: ProjectDetail;
  developerMode: boolean;
  onClose: () => void;
  onSaved: (project: ProjectDetail) => void;
}) {
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions);
  const [files, setFiles] = useState<ProjectFile[]>(project.files);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useDialogDismiss(onClose);

  const totalChars = files.reduce((sum, file) => sum + file.text.length, 0);

  const addFiles = useCallback(async (list: FileList | null) => {
    if (!list?.length) return;
    const selected = Array.from(list);
    const rejected = selected.filter((file) => !isTextLikeFile(file));
    if (rejected.length) {
      setError(`只能添加文本或代码文件：${rejected.map((file) => file.name).join("、")} 不支持。`);
      return;
    }
    if (selected.some((file) => file.size > MAX_FILE_BYTES)) {
      setError("单个文件不能超过 256KB。");
      return;
    }
    setError("");
    try {
      const texts = await Promise.all(selected.map(readFileAsText));
      setFiles((current) => {
        const next = [...current];
        for (let index = 0; index < selected.length; index += 1) {
          if (next.length >= MAX_PROJECT_FILES) break;
          const raw = texts[index];
          next.push({
            // 临时 id：保存时服务端会重新分配，这里只用于列表 key 和删除定位。
            id: `local-${Date.now()}-${index}`,
            name: selected[index].name,
            text: raw.slice(0, MAX_PROJECT_FILE_CHARS),
            truncated: raw.length > MAX_PROJECT_FILE_CHARS,
          });
        }
        return next;
      });
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "读取文件失败。");
    }
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/ai-projects/${project.id}${developerMode ? "?developerMode=1" : ""}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            instructions,
            // 只传服务端需要的三个字段：id 是本地临时值，回传只会造成混淆。
            files: files.map((file) => ({
              name: file.name,
              text: file.text,
              truncated: file.truncated,
            })),
          }),
        }
      );
      const data = await response.json().catch(() => null) as
        { project?: ProjectDetail; error?: string } | null;
      if (!response.ok || !data?.project) throw new Error(data?.error || "保存项目失败。");
      onSaved(data.project);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存项目失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.projectPanelBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.projectPanel}
        role="dialog"
        aria-modal="true"
        aria-label={`项目设置：${project.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.projectPanelHead}>
          <strong>项目设置</strong>
          <button type="button" onClick={onClose} aria-label="关闭项目设置" title="关闭">×</button>
        </div>

        <label className={styles.projectField}>
          <span>项目名称</span>
          <input
            value={name}
            maxLength={MAX_PROJECT_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：毕业论文"
          />
        </label>

        <label className={styles.projectField}>
          <span>
            项目指令
            <small>这个项目里的每次对话都会自动带上</small>
          </span>
          <textarea
            value={instructions}
            maxLength={MAX_PROJECT_INSTRUCTIONS_LENGTH}
            rows={6}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder={developerMode
              ? "例如：回答一律用中文，代码用 TypeScript，不要写多余解释。"
              : "例如：请用简洁的中文回答，多举例子。"}
          />
          <small className={styles.projectHint}>
            {instructions.length} / {MAX_PROJECT_INSTRUCTIONS_LENGTH}
            {developerMode ? null : "（作为参考偏好提供给模型，不会覆盖站点设定）"}
          </small>
        </label>

        <div className={styles.projectField}>
          <span>
            项目文件
            <small>最多 {MAX_PROJECT_FILES} 个，作为资料随每次对话一起发送</small>
          </span>
          {files.length > 0 ? (
            <ul className={styles.projectFileList}>
              {files.map((file) => (
                <li key={file.id}>
                  <span>
                    {file.name}
                    {file.truncated ? <em>（已截断）</em> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}
                    aria-label={`移除 ${file.name}`}
                    title="移除"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.projectHint}>还没有项目文件。</p>
          )}
          {files.length < MAX_PROJECT_FILES ? (
            <label className={styles.projectFileAdd}>
              <span>＋ 添加文件</span>
              <input
                type="file"
                multiple
                onChange={(event) => {
                  void addFiles(event.target.files);
                  // 清空 value：同一个文件被移除后再选一次，不清空则不触发 change。
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
          <small className={styles.projectHint}>
            合计 {totalChars.toLocaleString("zh-CN")} / {MAX_PROJECT_TOTAL_CHARS.toLocaleString("zh-CN")} 字符
            {totalChars > MAX_PROJECT_TOTAL_CHARS ? "（超出上限，保存会被拒绝）" : ""}
          </small>
        </div>

        {error ? <p className={styles.projectError} role="alert">{error}</p> : null}

        <div className={styles.projectPanelFoot}>
          <button type="button" onClick={onClose} disabled={saving}>取消</button>
          <button
            type="button"
            className={styles.projectSaveButton}
            onClick={() => void save()}
            disabled={saving || !name.trim()}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
