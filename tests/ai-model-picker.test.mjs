import test from "node:test";
import assert from "node:assert/strict";
import {
  flattenGroups,
  groupModelsByProvider,
  moveActiveIndex,
} from "../lib/ai-model-picker.ts";

function model(id, providerLabel, extra = {}) {
  return {
    id,
    label: id,
    providerLabel,
    supportsVision: false,
    supportsReasoning: false,
    ...extra,
  };
}

test("按供应商分组，且不打乱模型池里的优先级顺序", () => {
  const groups = groupModelsByProvider([
    model("a", "OpenRouter"),
    model("b", "DeepSeek"),
    model("c", "OpenRouter"),
  ]);
  // 分组顺序按供应商首次出现的位置，而不是字母序
  assert.deepEqual(groups.map((group) => group.provider), ["OpenRouter", "DeepSeek"]);
  // 同一供应商在池里不连续时也要归到一起
  assert.deepEqual(groups[0].models.map((item) => item.id), ["a", "c"]);
  assert.deepEqual(groups[1].models.map((item) => item.id), ["b"]);
});

test("拍平后的顺序与渲染顺序一致，键盘导航才不会跳", () => {
  const groups = groupModelsByProvider([
    model("a", "P1"),
    model("b", "P2"),
    model("c", "P1"),
  ]);
  assert.deepEqual(flattenGroups(groups).map((item) => item.id), ["a", "c", "b"]);
});

test("空模型池不产生分组", () => {
  assert.deepEqual(groupModelsByProvider([]), []);
  assert.deepEqual(flattenGroups([]), []);
});

test("键盘上下移动到头会回绕", () => {
  assert.equal(moveActiveIndex(0, 1, 3), 1);
  assert.equal(moveActiveIndex(2, 1, 3), 0);
  assert.equal(moveActiveIndex(0, -1, 3), 2);
  assert.equal(moveActiveIndex(1, -1, 3), 0);
});

test("没有高亮项时，向下从头开始、向上从末尾开始", () => {
  assert.equal(moveActiveIndex(-1, 1, 4), 0);
  assert.equal(moveActiveIndex(-1, -1, 4), 3);
});

test("列表为空时不产生越界下标", () => {
  assert.equal(moveActiveIndex(-1, 1, 0), -1);
  assert.equal(moveActiveIndex(0, 1, 0), -1);
});
