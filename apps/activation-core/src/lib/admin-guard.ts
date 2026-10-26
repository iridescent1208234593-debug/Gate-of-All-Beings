/**
 * 管理端鉴权守卫（双通道）
 *
 * 通道一：X-Admin-Key（众生之门式管理密钥，常量时间比对）
 * 通道二：既有 JWT Cookie（账密登录态，保留不变）
 *
 * 使用方式：路由处理器内调用 requireAdminAccess(request)，
 * 密钥通道或 JWT 通道任一通过即放行；两者均不通过返回 401。
 */

import { jwtVerify } from "jose";
import { extractAdminKey, isValidAdminKey } from "./admin-key";

export type AdminAccessVia = "admin-key" | "jwt" | "none";

export interface AdminAccessResult {
  ok: boolean;
  via: AdminAccessVia;
  username?: string;
  message?: string;
}

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

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

  const secret = getJwtSecret();
  const token = readCookie(request, "token");

  if (!secret || !token) {
    return { ok: false, via: "none", message: "未授权访问" };
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.id || !payload.username || payload.role !== "admin") {
      return { ok: false, via: "none", message: "Token 无效或已过期" };
    }

    return { ok: true, via: "jwt", username: String(payload.username) };
  } catch {
    return { ok: false, via: "none", message: "Token 无效或已过期" };
  }
}

/** 操作者标识（审计用） */
export function getAdminOperatorFrom(result: AdminAccessResult): string {
  return result.username ?? "unknown";
}
