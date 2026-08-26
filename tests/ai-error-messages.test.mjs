import test from "node:test";
import assert from "node:assert/strict";
import {
  describeFailure,
  describeFailureForDeveloper,
  describeFailureForVisitor,
  isTransientFailure,
} from "../lib/ai-error-messages.ts";

/** 访客文案里绝不能出现的字样：任何一条都能帮人推断出渠道。 */
const FORBIDDEN_FOR_VISITOR = [
  "API Key",
  "Base URL",
  "接口信息",
  "后台",
  "鉴权",
  "429",
  "限流",
  "节点",
  "模型名称",
];

const ALL_FAILURES = [
  { kind: "config_incomplete", missing: ["API Key", "模型名称"] },
  { kind: "unreachable" },
  { kind: "timeout" },
  { kind: "auth", status: 401, detail: "无权访问" },
  { kind: "model_not_found", status: 404, model: "gpt-4o", detail: "The model does not exist" },
  { kind: "rate_limited", status: 429, detail: "rate limit exceeded for org-abc123" },
  { kind: "provider_server", status: 503, detail: "upstream connect error" },
  { kind: "provider_status", status: 418 },
  { kind: "internal", internalMessage: "connect ECONNREFUSED 10.0.0.4:11434" },
];

test("访客文案不含任何渠道特征", () => {
  for (const failure of ALL_FAILURES) {
    const text = describeFailure(failure, false);
    for (const word of FORBIDDEN_FOR_VISITOR) {
      assert.ok(!text.includes(word), `${failure.kind} 的访客文案泄露了「${word}」：${text}`);
    }
  }
});

test("访客文案不含上游返回的原文、模型名与状态码", () => {
  const leaks = ["无权访问", "gpt-4o", "The model does not exist", "org-abc123", "ECONNREFUSED", "10.0.0.4", "418"];
  for (const failure of ALL_FAILURES) {
    const text = describeFailure(failure, false);
    for (const leak of leaks) {
      assert.ok(!text.includes(leak), `${failure.kind} 的访客文案泄露了「${leak}」：${text}`);
    }
  }
});

test("访客文案只有两种，按可否重试区分", () => {
  const variants = new Set(ALL_FAILURES.map((f) => describeFailure(f, false)));
  assert.equal(variants.size, 2);
  assert.match(describeFailure({ kind: "rate_limited" }, false), /有点忙/);
  assert.match(describeFailure({ kind: "auth" }, false), /暂时不可用/);
});

test("可重试分类符合预期", () => {
  assert.ok(isTransientFailure("timeout"));
  assert.ok(isTransientFailure("rate_limited"));
  assert.ok(isTransientFailure("provider_server"));
  assert.ok(isTransientFailure("unreachable"));
  assert.ok(!isTransientFailure("auth"));
  assert.ok(!isTransientFailure("model_not_found"));
  assert.ok(!isTransientFailure("config_incomplete"));
  assert.ok(!isTransientFailure("internal"));
});

test("开发者文案保留完整诊断信息", () => {
  assert.match(describeFailure({ kind: "auth", detail: "无权访问" }, true), /API Key/);
  assert.match(describeFailure({ kind: "auth", detail: "无权访问" }, true), /接口信息：无权访问/);
  assert.match(describeFailure({ kind: "model_not_found", model: "gpt-4o" }, true), /「gpt-4o」/);
  assert.match(describeFailure({ kind: "provider_status", status: 418 }, true), /418/);
  assert.match(
    describeFailure({ kind: "config_incomplete", missing: ["API Key", "模型名称"] }, true),
    /缺少：API Key、模型名称/
  );
  assert.match(
    describeFailure({ kind: "internal", internalMessage: "connect ECONNREFUSED" }, true),
    /ECONNREFUSED/
  );
});

test("开发者文案在缺少可选字段时不出现 undefined", () => {
  for (const kind of ["config_incomplete", "unreachable", "timeout", "auth", "model_not_found",
    "rate_limited", "provider_server", "provider_status", "internal"]) {
    const text = describeFailureForDeveloper({ kind });
    assert.ok(!text.includes("undefined"), `${kind}: ${text}`);
    assert.ok(text.length > 0, `${kind} 文案为空`);
  }
});

test("没有 detail 时不拼出空的括号", () => {
  assert.ok(!describeFailureForDeveloper({ kind: "auth" }).includes("接口信息"));
  assert.ok(!describeFailureForDeveloper({ kind: "auth", detail: "" }).includes("接口信息"));
});

test("访客文案函数只接受 kind，无法被塞进上游细节", () => {
  // 签名层面的保证：传对象进去也不会有东西被拼进文案。
  assert.equal(describeFailureForVisitor("auth"), describeFailure({ kind: "auth", detail: "x" }, false));
});
