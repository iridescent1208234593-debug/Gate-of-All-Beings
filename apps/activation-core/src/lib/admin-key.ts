/**
 * 管理密钥通道（众生之门式 X-Admin-Key）
 *
 * - 与既有的 JWT 账密通道并存：密钥优先、JWT 回落
 * - 密钥来自环境变量 ADMIN_SECRET，使用 crypto.timingSafeEqual 做常量时间比较
 * - 长度不等直接视为不匹配（不进入 timingSafeEqual，避免抛异常）
 * - 未配置 ADMIN_SECRET 时，任何密钥都不通过（安全默认）
 */

import { timingSafeEqual } from "node:crypto";
import { getAdminSecretValue, getEventAccessCodeValue } from "./server-credentials";

export const ADMIN_KEY_HEADER = "x-admin-key";

/** 读取服务端配置的管理密钥（未配置返回 null） */
export function getAdminSecret(): string | null {
  return getAdminSecretValue();
}

export function isAdminKeyConfigured(): boolean {
  return getAdminSecret() !== null;
}

/** 从请求头提取密钥：优先 X-Admin-Key，其次 Authorization: Bearer */
export function extractAdminKey(request: Request): string | null {
  const headerKey = request.headers.get(ADMIN_KEY_HEADER);
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim();
  }

  const authorization = request.headers.get("authorization");
  if (authorization && /^bearer\s+/i.test(authorization)) {
    const bearer = authorization.replace(/^bearer\s+/i, "").trim();
    if (bearer.length > 0 && bearer !== "undefined" && bearer !== "null") {
      return bearer;
    }
  }

  return null;
}

/** 常量时间比较（长度不等直接视为不匹配） */
export function isValidAdminKey(candidate: string | null | undefined): boolean {
  const secret = getAdminSecret();
  if (!secret || !candidate) return false;

  const candidateBuffer = Buffer.from(candidate, "utf8");
  const secretBuffer = Buffer.from(secret, "utf8");

  if (candidateBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, secretBuffer);
}

/** 请求级校验：请求头中携带合法 X-Admin-Key 时返回 true */
export function verifyAdminKey(request: Request): boolean {
  return isValidAdminKey(extractAdminKey(request));
}

/** 事件访问码（可选配置；未配置则该通道关闭） */
export function getEventAccessCode(): string | null {
  return getEventAccessCodeValue();
}

export function isEventAccessConfigured(): boolean {
  return getEventAccessCode() !== null;
}

/** 事件码校验：与 EVENT_ACCESS_CODE 常量时间比对 */
export function isValidEventAccessCode(candidate: string | null | undefined): boolean {
  const secret = getEventAccessCode();
  if (!secret || !candidate) return false;

  const candidateBuffer = Buffer.from(candidate, "utf8");
  const secretBuffer = Buffer.from(secret, "utf8");

  if (candidateBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, secretBuffer);
}
