/**
 * 管理端鉴权守卫（双通道）——管理 API 唯一的鉴权规则来源
 *
 * 通道一：X-Admin-Key（众生之门式管理密钥，常量时间比对）
 * 通道二：既有 JWT Cookie（账密登录态：验证签名、有效期与 admin 角色，不只解码 payload）
 *
 * 使用方式：/api/admin/* 的每个处理器都写成
 *   export const GET = withAdminAccess(async (request, context, access) => { ... });
 * 路由自身完成鉴权，proxy 只是入口层的第一道防护，不是唯一安全边界。
 * tests/admin-route-auth.test.mjs 会检查所有管理路由都这样导出。
 */

import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { extractAdminKey, isValidAdminKey } from "./admin-key";
import { getJwtSecretKey } from "./server-credentials";

export type AdminAccessVia = "admin-key" | "jwt" | "none";

export interface AdminAccessResult {
  ok: boolean;
  via: AdminAccessVia;
  username?: string;
  /** 仅 JWT 通道：管理员账号主键 */
  adminId?: number;
  message?: string;
}

export const ADMIN_SESSION_COOKIE = "token";

/** 从 Cookie 头中提取指定 cookie 值 */
export function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      const value = trimmed.slice(name.length + 1);
      return value.length > 0 ? value : null;
    }
  }

  return null;
}

/** 双通道鉴权：密钥优先，JWT 回落 */
export async function requireAdminAccess(request: Request): Promise<AdminAccessResult> {
  const providedKey = extractAdminKey(request);

  if (providedKey) {
    if (isValidAdminKey(providedKey)) {
      return { ok: true, via: "admin-key", username: "admin-key" };
    }

    return { ok: false, via: "none", message: "管理密钥无效" };
  }

  const token = readCookie(request, ADMIN_SESSION_COOKIE);

  if (!token) {
    return { ok: false, via: "none", message: "未授权访问" };
  }

  return verifyAdminSessionToken(token);
}

/** 验证管理员会话 JWT：签名（HS256）、有效期、id/username 与 admin 角色 */
export async function verifyAdminSessionToken(token: string): Promise<AdminAccessResult> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), { algorithms: ["HS256"] });
    const adminId = Number(payload.id);
    if (!Number.isInteger(adminId) || adminId < 1 || !payload.username || payload.role !== "admin") {
      return { ok: false, via: "none", message: "Token 无效或已过期" };
    }

    return { ok: true, via: "jwt", username: String(payload.username), adminId };
  } catch {
    return { ok: false, via: "none", message: "Token 无效或已过期" };
  }
}

export interface WithAdminAccessOptions {
  /** 只接受账号登录态（JWT），拒绝管理密钥通道（如修改密码需要知道是哪个账号） */
  requireSession?: boolean;
}

type AdminRouteHandler<Context> = (
  request: NextRequest,
  context: Context,
  access: AdminAccessResult & { ok: true }
) => Response | Promise<Response>;

/**
 * 管理路由包装器：先执行完整管理员鉴权，通过后才调用处理器。
 * 不依赖 proxy 注入的任何请求头；操作者身份只从返回的 access 读取。
 */
export function withAdminAccess<Context = unknown>(
  handler: AdminRouteHandler<Context>,
  options: WithAdminAccessOptions = {}
): (request: NextRequest, context: Context) => Promise<Response> {
  return async (request, context) => {
    const access = await requireAdminAccess(request);

    if (!access.ok) {
      return NextResponse.json(
        { success: false, message: access.message ?? "未授权访问" },
        { status: 401 }
      );
    }

    if (options.requireSession && access.via !== "jwt") {
      return NextResponse.json(
        { success: false, message: "该操作需要管理员账号登录" },
        { status: 403 }
      );
    }

    return handler(request, context, access as AdminAccessResult & { ok: true });
  };
}

/** 操作者标识（审计用） */
export function getAdminOperatorFrom(result: AdminAccessResult): string {
  return result.username ?? "unknown";
}
