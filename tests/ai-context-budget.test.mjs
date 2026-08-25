import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateMessagesTokens,
  estimateTokens,
  MIN_VERBATIM_MESSAGES,
  MIN_HISTORY_BUDGET_TOKENS,
  planContextCompression,
  renderTranscriptForSummary,
  resolveHistoryBudget,
  wrapSummaryAsContext,
} from "../lib/ai-context-budget.ts";

test("token 估算对中英文分别取不同密度", () => {
  assert.equal(estimateTokens(""), 0);
  // 中文按 1 token/字
  assert.equal(estimateTokens("你好世界"), 4);
  // 英文按 4 字符/token
  assert.equal(estimateTokens("abcdefgh"), 2);
  // 混排取两者之和
  assert.equal(estimateTokens("你好abcd"), 3);
});

test("预算充足时不做任何压缩", () => {
  const messages = [
    { role: "user", content: "你好" },
    { role: "assistant", content: "你好，有什么可以帮你" },
  ];
  const plan = planContextCompression(messages, 10000);
  assert.equal(plan.needsCompression, false);
  assert.deepEqual(plan.verbatim, messages);
  assert.deepEqual(plan.toSummarize, []);
});

test("消息条数不足最小保留数时不压缩，避免把近期对话摘要掉", () => {
  const messages = Array.from({ length: MIN_VERBATIM_MESSAGES }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: "很长的内容".repeat(500),
  }));
  const plan = planContextCompression(messages, 10);
  assert.equal(plan.needsCompression, false);
  assert.equal(plan.verbatim.length, MIN_VERBATIM_MESSAGES);
});

test("超预算时切出早期消息，近期原文至少保留到下限", () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `第 ${index} 轮的内容` + "填充".repeat(200),
  }));
  const plan = planContextCompression(messages, 2000);

  assert.equal(plan.needsCompression, true);
  assert.ok(plan.toSummarize.length > 0, "应当有待压缩的早期消息");
  assert.ok(plan.verbatim.length >= MIN_VERBATIM_MESSAGES, "近期原文不少于下限");
  // 切分不重不漏
  assert.equal(plan.toSummarize.length + plan.verbatim.length, messages.length);
  assert.deepEqual([...plan.toSummarize, ...plan.verbatim], messages);
  // 保留的是最近的那一段
  assert.deepEqual(plan.verbatim.at(-1), messages.at(-1));
});

test("预算极小时仍保留最近若干轮，且不会把全部消息都拿去压缩", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: "内容".repeat(300),
  }));
  const plan = planContextCompression(messages, 1);
  assert.equal(plan.needsCompression, true);
  assert.ok(plan.verbatim.length >= MIN_VERBATIM_MESSAGES);
  assert.ok(plan.toSummarize.length >= 1);
});

test("消息 token 估算计入每条的固定开销", () => {
  const single = estimateMessagesTokens([{ role: "user", content: "你好" }]);
  assert.equal(single, 2 + 4);
});

test("待压缩历史被渲染为带角色前缀的纯文本", () => {
  const text = renderTranscriptForSummary([
    { role: "user", content: "帮我改一下上传逻辑" },
    { role: "assistant", content: "已经改成直传" },
  ]);
  assert.match(text, /用户：帮我改一下上传逻辑/);
  assert.match(text, /助手：已经改成直传/);
});

test("摘要包装说明这段是压缩内容，空摘要不产生噪音", () => {
  assert.equal(wrapSummaryAsContext("   "), "");
  const wrapped = wrapSummaryAsContext("用户想改上传逻辑");
  assert.match(wrapped, /压缩摘要/);
  assert.match(wrapped, /用户想改上传逻辑/);
});

test("系统消息占用从历史预算中扣除", () => {
  const instructions = "你".repeat(500);
  const budget = resolveHistoryBudget(10000, [instructions, ""]);
  // 500 个汉字约 500 token，应当被实打实扣掉
  assert.equal(budget, 10000 - estimateTokens(instructions));
});

test("空系统消息不影响预算，且预算有下限保护", () => {
  assert.equal(resolveHistoryBudget(10000, ["", ""]), 10000);
  // 系统消息超长时不能把历史预算压到 0 或负数
  const huge = "字".repeat(50000);
  assert.equal(resolveHistoryBudget(10000, [huge]), MIN_HISTORY_BUDGET_TOKENS);
});

test("保留原文条数可配：调小则压缩更多早期消息", () => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: "内容".repeat(50),
  }));
  const budget = 600;
  const loose = planContextCompression(messages, budget, 2);
  const tight = planContextCompression(messages, budget, 20);
  assert.equal(loose.needsCompression, true);
  assert.equal(tight.needsCompression, true);
  // 保留条数越大，留在原文里的越多、被压缩的越少
  assert.ok(tight.verbatim.length > loose.verbatim.length);
  assert.ok(tight.toSummarize.length < loose.toSummarize.length);
  assert.ok(loose.verbatim.length >= 2);
  assert.ok(tight.verbatim.length >= 20);
});

test("保留条数大于会话长度时等于关闭压缩，全量原文照发", () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: "内容".repeat(200),
  }));
  // 预算远远不够，但保留条数被调到比会话还长
  const plan = planContextCompression(messages, 100, 100000);
  assert.equal(plan.needsCompression, false);
  assert.equal(plan.toSummarize.length, 0);
  assert.equal(plan.verbatim.length, messages.length);
});

test("非法保留条数被规整为至少 1 条，不会退化成空上下文", () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: "内容".repeat(80),
  }));
  for (const bad of [0, -5, Number.NaN]) {
    const plan = planContextCompression(messages, 200, bad);
    assert.ok(plan.verbatim.length >= 1, `保留条数 ${bad} 时仍应留下原文`);
  }
});

test("不传保留条数时沿用默认值", () => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: "内容".repeat(50),
  }));
  const implicit = planContextCompression(messages, 600);
  const explicit = planContextCompression(messages, 600, MIN_VERBATIM_MESSAGES);
  assert.deepEqual(implicit.verbatim.length, explicit.verbatim.length);
});

test("超长自定义指令会提前触发压缩", () => {
  const messages = Array.from({ length: MIN_VERBATIM_MESSAGES + 6 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: "内容".repeat(100),
  }));
  const total = 3000;
  // 无指令时预算够用，不压缩
  assert.equal(planContextCompression(messages, resolveHistoryBudget(total, [""])).needsCompression, false);
  // 指令吃掉大半预算后，同一段历史就需要压缩了
  const plan = planContextCompression(messages, resolveHistoryBudget(total, ["指".repeat(2200)]));
  assert.equal(plan.needsCompression, true);
  assert.ok(plan.toSummarize.length > 0);
});
