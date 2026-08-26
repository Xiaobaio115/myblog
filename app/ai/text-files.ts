/**
 * 文本/代码文件的客户端读取与判别。
 *
 * 从 AiChatPage 抽出来是因为项目模块的「项目文件」也要用同一套判别：
 * 两处各写一份的话，聊天里能附的文件类型和项目里能加的文件类型会慢慢漂移。
 */

export function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取 ${file.name} 失败。`));
    reader.readAsText(file);
  });
}

/**
 * 文本/代码文件的扩展名白名单。
 *
 * 不按 MIME 判断：浏览器给 .ts、.vue、.rs 之类的文件常常报空字符串或
 * application/octet-stream，只看 MIME 会把正常代码文件全部拒掉。
 */
export const TEXT_FILE_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "log", "csv", "tsv",
  "json", "jsonc", "yaml", "yml", "toml", "ini", "env", "conf", "properties",
  "xml", "html", "htm", "css", "scss", "sass", "less",
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "vue", "svelte",
  "py", "rb", "go", "rs", "java", "kt", "kts", "swift", "c", "h", "cpp", "hpp", "cc", "cs",
  "php", "sh", "bash", "zsh", "fish", "ps1", "sql", "graphql", "gql",
  "dockerfile", "gitignore", "editorconfig", "lua", "r", "pl", "dart", "scala", "ex", "exs",
]);

export function getFileExtension(name: string) {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot === -1) return lower;
  return lower.slice(dot + 1);
}

export function isTextLikeFile(file: File) {
  if (file.type.startsWith("text/")) return true;
  return TEXT_FILE_EXTENSIONS.has(getFileExtension(file.name));
}
