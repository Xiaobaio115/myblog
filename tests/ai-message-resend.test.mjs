import assert from "node:assert/strict";
import test from "node:test";
import {
  describeResendFallout,
  findLastUserIndex,
  mergeImagesByUrl,
  planResend,
} from "../lib/ai-message-resend.ts";

function userMessage(id, content, extra = {}) {
  return { id, role: "user", content, ...extra };
}

function assistantMessage(id, content, extra = {}) {
  return { id, role: "assistant", content, ...extra };
}

test("findLastUserIndex 找的是最后一条而不是第一条用户消息", () => {
  const messages = [
    userMessage("u1", "第一问"),
    assistantMessage("a1", "第一答"),
    userMessage("u2", "第二问"),
    assistantMessage("a2", "第二答"),
  ];
  assert.equal(findLastUserIndex(messages), 2);
});

test("findLastUserIndex 在没有用户消息时返回 -1", () => {
  assert.equal(findLastUserIndex([]), -1);
  assert.equal(findLastUserIndex([assistantMessage("a1", "开场白")]), -1);
});

test("模型报错后重发定位到错误提示上面的那条提问", () => {
  // 请求失败时错误文案会作为助手消息落在最后，重发必须跳过它。
  const messages = [
    userMessage("u1", "帮我看看这段代码"),
    assistantMessage("a1", "聊天服务暂时不可用。", { errored: true }),
  ];
  const plan = planResend(messages, false);
  assert.equal(plan.index, 0);
  assert.equal(plan.message.content, "帮我看看这段代码");
});

test("重发会带回原消息的图片，url 与文件名一一对应", () => {
  const messages = [
    userMessage("u1", "这张图里是什么", {
      imageNames: ["a.png", "b.png"],
      imagePreviews: ["https://blob/a.png", "https://blob/b.png"],
    }),
    assistantMessage("a1", "失败了", { errored: true }),
  ];
  const plan = planResend(messages, true);
  assert.deepEqual(plan.images, [
    { name: "a.png", url: "https://blob/a.png" },
    { name: "b.png", url: "https://blob/b.png" },
  ]);
  assert.equal(plan.imagesDropped, false);
});

test("文件名缺失时用占位名，不产生 undefined", () => {
  const messages = [
    userMessage("u1", "看图", { imagePreviews: ["data:image/png;base64,AAA"] }),
  ];
  const plan = planResend(messages, true);
  assert.deepEqual(plan.images, [{ name: "图片1", url: "data:image/png;base64,AAA" }]);
});

test("目标模型不支持读图时摘掉图片并标记出来", () => {
  const messages = [
    userMessage("u1", "看图", {
      imageNames: ["a.png"],
      imagePreviews: ["https://blob/a.png"],
    }),
  ];
  const plan = planResend(messages, false);
  assert.deepEqual(plan.images, []);
  assert.equal(plan.imagesDropped, true);
});

test("原消息本来没图时不会误报图片被丢弃", () => {
  const plan = planResend([userMessage("u1", "纯文本提问")], false);
  assert.deepEqual(plan.images, []);
  assert.equal(plan.imagesDropped, false);
  assert.equal(describeResendFallout(plan.imagesDropped, plan.lostFileNames), "");
});

test("文本附件带不回来，但会报出文件名", () => {
  const messages = [
    userMessage("u1", "review 一下", { fileNames: ["main.ts", "util.ts"] }),
  ];
  const plan = planResend(messages, true);
  assert.deepEqual(plan.lostFileNames, ["main.ts", "util.ts"]);
  assert.equal(
    describeResendFallout(plan.imagesDropped, plan.lostFileNames),
    "文本附件（main.ts、util.ts）需要重新添加。"
  );
});

test("图片和文本附件同时受影响时两条说明都给出", () => {
  const text = describeResendFallout(true, ["main.ts"]);
  assert.match(text, /不支持读图/);
  assert.match(text, /main\.ts/);
  assert.equal(text.endsWith("。"), true);
});

test("没有用户消息时 planResend 返回 null 而不是抛错", () => {
  assert.equal(planResend([], true), null);
  assert.equal(planResend([assistantMessage("a1", "开场白")], true), null);
});

test("重发保留输入框里新排队的图片，不会覆盖掉刚上传的文件", () => {
  const restored = [{ name: "old.png", url: "https://blob/old.png" }];
  const pending = [{ name: "new.png", url: "https://blob/new.png" }];
  assert.deepEqual(mergeImagesByUrl(restored, pending), [
    { name: "old.png", url: "https://blob/old.png" },
    { name: "new.png", url: "https://blob/new.png" },
  ]);
});

test("同一个 url 只保留一份，重复重发不会叠加同一张图", () => {
  const same = { name: "a.png", url: "https://blob/a.png" };
  assert.deepEqual(mergeImagesByUrl([same], [{ name: "改过名.png", url: "https://blob/a.png" }]), [same]);
});

test("同名但不同 url 的图片都保留：同名不代表同一张图", () => {
  const merged = mergeImagesByUrl(
    [{ name: "截图.png", url: "https://blob/1.png" }],
    [{ name: "截图.png", url: "https://blob/2.png" }]
  );
  assert.equal(merged.length, 2);
});

test("两边都为空时合并结果为空数组", () => {
  assert.deepEqual(mergeImagesByUrl([], []), []);
});
