export type AiPromptControls = {
  useKnowledgeText: boolean;
  useModePrompt: boolean;
  useSiteContext: boolean;
  useFormattingPrompt: boolean;
  useLocalFallbacks: boolean;
};

export const AI_PROMPT_CONTROL_DEFAULTS: AiPromptControls = {
  useKnowledgeText: true,
  useModePrompt: true,
  useSiteContext: true,
  useFormattingPrompt: true,
  useLocalFallbacks: true,
};

export const AI_FORMATTING_PROMPT =
  "输出可以使用 Markdown；代码请使用带语言标记的围栏代码块；表情符号可按语气自然使用。不要输出原始 HTML。";

export function composeAiSystemPrompt(input: {
  systemPrompt: string;
  knowledgeText: string;
  modePrompt: string;
  controls: AiPromptControls;
}) {
  const parts = [input.systemPrompt.trim()];

  if (input.controls.useKnowledgeText && input.knowledgeText.trim()) {
    parts.push(`知识补充：\n${input.knowledgeText.trim()}`);
  }
  if (input.controls.useModePrompt && input.modePrompt.trim()) {
    parts.push(input.modePrompt.trim());
  }
  if (input.controls.useFormattingPrompt) {
    parts.push(AI_FORMATTING_PROMPT);
  }

  return parts.filter(Boolean).join("\n\n");
}
