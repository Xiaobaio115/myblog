/**
 * 聊天接口的错误文案分级。
 *
 * 同一个故障要给出两套说法：
 * - 开发者（后台 AI 页，已通过管理员鉴权）：完整诊断信息，包括状态码、模型名、
 *   供应商返回的原文。这些是定位问题的唯一线索，不能省。
 * - 前台访客：只说「能不能重试」，不透露任何渠道特征。
 *
 * 为什么访客侧连状态码都不给：401 意味着「站长在用一个需要密钥的第三方接口」，
 * 404 会带出模型名，供应商原文里常有供应商名、组织 id、请求 id 和端点地址。
 * 这些拼起来足以推断出站长用的是哪家渠道，而访客并不需要知道。
 */

export type ProviderFailureKind =
  /** 后台三要素没配全 */
  | "config_incomplete"
  /** 连不上（DNS、网络、Base URL 写错） */
  | "unreachable"
  /** 超时 */
  | "timeout"
  /** 401/403，密钥无效或过期 */
  | "auth"
  /** 404，模型名与端点不匹配 */
  | "model_not_found"
  /** 429 限流 */
  | "rate_limited"
  /** 供应商 5xx */
  | "provider_server"
  /** 其他非 2xx */
  | "provider_status"
  /** 我们自己这边抛异常了 */
  | "internal";

export type ProviderFailure = {
  kind: ProviderFailureKind;
  /** 供应商返回的 HTTP 状态码 */
  status?: number;
  /** 供应商错误体里提取出的可读原因 */
  detail?: string;
  /** 上游模型名（不是我们的 modelId） */
  model?: string;
  /** config_incomplete 时缺失的字段名 */
  missing?: string[];
  /** internal 时的异常 message */
  internalMessage?: string;
};

/**
 * 故障是不是「等一会儿可能自己好」。
 *
 * 这个区分不泄露渠道信息，却是访客唯一需要知道的事：
 * 该重试，还是该去找站长。
 */
export function isTransientFailure(kind: ProviderFailureKind): boolean {
  return kind === "timeout" || kind === "rate_limited" || kind === "provider_server" || kind === "unreachable";
}

/** 开发者侧文案：带全部诊断信息。 */
export function describeFailureForDeveloper(failure: ProviderFailure): string {
  const base = (() => {
    switch (failure.kind) {
      case "config_incomplete":
        return `AI 模型配置不完整，缺少：${(failure.missing || []).join("、") || "必填项"}。请在后台「AI 与通知」中补全后重试。`;
      case "unreachable":
        return "无法连接模型接口，请检查后台 AI 配置中的 Base URL 与网络连通性。";
      case "timeout":
        return "模型接口响应超时，请稍后再试。";
      case "auth":
        return "模型接口拒绝了 API Key（鉴权失败），请在后台核对 Key 是否有效或已过期。";
      case "model_not_found":
        return `模型接口找不到模型「${failure.model || "未知"}」，请核对模型名称与 Base URL 是否匹配。`;
      case "rate_limited":
        return "模型接口触发了限流（429），请稍后再试或更换模型节点。";
      case "provider_server":
        return "模型接口自身返回了服务端错误，请稍后再试或更换模型节点。";
      case "provider_status":
        return `模型接口返回异常状态 ${failure.status ?? "未知"}。`;
      case "internal":
        return failure.internalMessage || "聊天服务暂时不可用。";
    }
  })();
  return failure.detail ? `${base}（接口信息：${failure.detail}）` : base;
}

/**
 * 访客侧文案：只区分「可重试」与「已坏」，不含任何渠道特征。
 *
 * 刻意不接受 failure 里的 detail / model / status，从签名上就保证
 * 不会有人「顺手」把上游信息拼进访客文案。
 */
export function describeFailureForVisitor(kind: ProviderFailureKind): string {
  return isTransientFailure(kind)
    ? "AI 助手现在有点忙，请稍等一下再试。"
    : "AI 助手暂时不可用，稍后会恢复。";
}

/** 按身份选文案。developerMode 必须是已鉴权后的结果，不能直接用请求体里的字段。 */
export function describeFailure(failure: ProviderFailure, developerMode: boolean): string {
  return developerMode
    ? describeFailureForDeveloper(failure)
    : describeFailureForVisitor(failure.kind);
}
