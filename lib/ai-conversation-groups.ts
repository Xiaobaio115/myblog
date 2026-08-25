/**
 * AI 会话的归属分组。
 *
 * 两类会话存在不同集合里，生命周期也不同：
 * - visitor：前台匿名访客，按 Cookie 派生的 visitorHash 归属，受保留天数 TTL 和每访客条数上限约束。
 * - developer：后台 AI 页，属于管理员本人，永久保存、不受条数限制。
 *
 * 之所以做成一个独立模块而不是在路由里写字符串字面量：
 * 路由、后台页、删除逻辑三处都要认这两个值，散着写迟早对不上。
 */

export const CONVERSATION_GROUPS = ["visitor", "developer"] as const;

export type ConversationGroup = (typeof CONVERSATION_GROUPS)[number];

export const DEFAULT_CONVERSATION_GROUP: ConversationGroup = "visitor";

export const CONVERSATION_GROUP_LABELS: Record<ConversationGroup, string> = {
  visitor: "前台访客",
  developer: "后台开发者",
};

/**
 * 把外部传入的分组值收敛成合法值。
 *
 * 认不出来一律回落到 visitor 而不是抛错：这个参数只决定「看哪一组」，
 * 猜错的代价是看到另一组列表，而抛错会让后台页整个打不开。
 * 但删除操作必须先确认分组，见 isConversationGroup。
 */
export function normalizeConversationGroup(value: unknown): ConversationGroup {
  return isConversationGroup(value) ? value : DEFAULT_CONVERSATION_GROUP;
}

/**
 * 严格判断，不做回落。
 *
 * 删除请求必须用这个而不是 normalizeConversationGroup：
 * 一个拼错的分组名被静默当成 visitor，会导致「本想清空开发者会话，
 * 结果清空了访客会话」这种不可逆的误删。
 */
export function isConversationGroup(value: unknown): value is ConversationGroup {
  return typeof value === "string" && (CONVERSATION_GROUPS as readonly string[]).includes(value);
}
