import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_PROMPT_CONTROL_DEFAULTS,
  composeAiSystemPrompt,
} from "../lib/ai-prompt.ts";

test("core-only mode sends no blog, mode or formatting instructions", () => {
  const prompt = composeAiSystemPrompt({
    systemPrompt: "这是后台填写的唯一核心行为。",
    knowledgeText: "博客知识",
    modePrompt: "导览模式",
    controls: {
      useKnowledgeText: false,
      useModePrompt: false,
      useSiteContext: false,
      useFormattingPrompt: false,
      useLocalFallbacks: false,
    },
  });

  assert.equal(prompt, "这是后台填写的唯一核心行为。");
  assert.doesNotMatch(prompt, /博客知识|导览模式|Markdown/);
});

test("enabled prompt layers are composed in a stable order", () => {
  const prompt = composeAiSystemPrompt({
    systemPrompt: "核心",
    knowledgeText: "资料",
    modePrompt: "模式",
    controls: AI_PROMPT_CONTROL_DEFAULTS,
  });

  assert.ok(prompt.indexOf("核心") < prompt.indexOf("知识补充"));
  assert.ok(prompt.indexOf("知识补充") < prompt.indexOf("模式"));
  assert.match(prompt, /Markdown/);
});

test("an empty core prompt is allowed when every layer is disabled", () => {
  const prompt = composeAiSystemPrompt({
    systemPrompt: "",
    knowledgeText: "",
    modePrompt: "",
    controls: {
      ...AI_PROMPT_CONTROL_DEFAULTS,
      useKnowledgeText: false,
      useModePrompt: false,
      useFormattingPrompt: false,
    },
  });

  assert.equal(prompt, "");
});
