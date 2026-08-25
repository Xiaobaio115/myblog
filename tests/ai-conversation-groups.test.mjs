import assert from "node:assert/strict";
import test from "node:test";
import {
  CONVERSATION_GROUPS,
  CONVERSATION_GROUP_LABELS,
  DEFAULT_CONVERSATION_GROUP,
  isConversationGroup,
  normalizeConversationGroup,
} from "../lib/ai-conversation-groups.ts";

test("两组分别是前台访客与后台开发者", () => {
  assert.deepEqual([...CONVERSATION_GROUPS], ["visitor", "developer"]);
  assert.equal(DEFAULT_CONVERSATION_GROUP, "visitor");
});

test("每个分组都有中文标签，后台页不会显示原始英文值", () => {
  for (const group of CONVERSATION_GROUPS) {
    assert.equal(typeof CONVERSATION_GROUP_LABELS[group], "string");
    assert.ok(CONVERSATION_GROUP_LABELS[group].length > 0);
  }
});

test("normalizeConversationGroup 认得合法值", () => {
  assert.equal(normalizeConversationGroup("visitor"), "visitor");
  assert.equal(normalizeConversationGroup("developer"), "developer");
});

test("读取用的归一把非法值回落到默认组，不抛错", () => {
  // 这个参数只决定「看哪一组」，猜错的代价是看到另一组列表；
  // 抛错会让后台页整个打不开，代价更大。
  for (const bad of ["", "admin", "VISITOR", null, undefined, 0, {}, []]) {
    assert.equal(normalizeConversationGroup(bad), "visitor");
  }
});

test("删除用的严格判断不接受任何非法值", () => {
  assert.equal(isConversationGroup("visitor"), true);
  assert.equal(isConversationGroup("developer"), true);
  for (const bad of ["", "admin", "Developer", "developer ", null, undefined, 0, {}, []]) {
    assert.equal(isConversationGroup(bad), false);
  }
});

test("严格判断不会把拼错的分组名当成默认组", () => {
  // 关键的安全属性：拼错的分组名如果被静默当成 visitor，
  // 「本想清空开发者会话」会变成「清空了访客会话」，且不可逆。
  const typo = "developers";
  assert.equal(normalizeConversationGroup(typo), "visitor");
  assert.equal(isConversationGroup(typo), false);
});
