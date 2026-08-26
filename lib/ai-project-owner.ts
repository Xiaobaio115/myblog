import "server-only";

import { verifyAdminRequest } from "@/lib/admin-session";
import { getVisitorIdentity } from "@/lib/ai-conversations";
import type { ProjectOwner } from "@/lib/ai-projects";

/**
 * 解析项目归属。
 *
 * developerMode 必须经过管理员 Cookie 校验后才认——否则任何人加个查询参数
 * 就能读写站长的项目。校验失败一律降级成访客而不是报错：「Cookie 过期」和
 * 「本来就是访客」在这个接口上应该有同样的结果。
 *
 * 放在 lib 而不是 route.ts 里：App Router 的 route 文件只应导出 HTTP 方法处理器，
 * 从中 import 普通函数会让另一个 route 文件被当成模块依赖加载。
 */
export function resolveProjectOwner(
  request: Request,
  wantsDeveloper: boolean,
  create = false
): { owner: ProjectOwner; visitor: ReturnType<typeof getVisitorIdentity> } | null {
  if (wantsDeveloper && verifyAdminRequest(request)) {
    return { owner: { group: "developer" }, visitor: null };
  }
  const visitor = getVisitorIdentity(request, create);
  if (!visitor) return null;
  return { owner: { group: "visitor", visitorHash: visitor.hash }, visitor };
}

/** 请求是否声称自己是开发者。真伪由 resolveProjectOwner 判定。 */
export function wantsDeveloperProject(request: Request) {
  return new URL(request.url).searchParams.get("developerMode") === "1";
}
