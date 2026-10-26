/**
 * 激活码状态统一派生模块（众生之门式四态对齐）
 *
 * 设计口径（改造方案 2.2 错位二）：
 * - 持久状态（写库）：active / invalidated
 * - 派生状态（不落库，读取时计算）：expired / exhausted
 *
 * 派生优先级固定为：invalidated → expired → exhausted → active
 * 列表、详情、导出、统计四处必须复用本函数，禁止各写一套判断。
 */

import type {
  ActivationCodeDerivedStatus,
  ActivationCodePersistentStatus,
} from "@/db/schema/activation-codes";

/** 可参与状态派生的最小字段集合（仓储行 / API 行 / 导出记录均兼容） */
export interface DerivableActivationCode {
  status?: string | null;
  expires_at?: Date | string | null;
  revoked_at?: Date | string | null;
  max_uses?: number | null;
  used_count?: number | null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInt(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** 是否已作废（持久态） */
export function isCodeInvalidated(code: DerivableActivationCode): boolean {
  return code.status === "invalidated" || Boolean(code.revoked_at);
}

/** 是否已过期（绝对截止时间已到） */
export function isCodeExpired(
  code: DerivableActivationCode,
  now: Date = new Date()
): boolean {
  const expiresAt = toDate(code.expires_at);
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

/** 次数是否已耗尽（max_uses 为 null 表示不限次） */
export function isCodeExhausted(code: DerivableActivationCode): boolean {
  const maxUses = toInt(code.max_uses);
  if (maxUses === null) return false;
  return (toInt(code.used_count) ?? 0) >= maxUses;
}

/**
 * 派生激活码状态，优先级：invalidated → expired → exhausted → active
 */
export function deriveActivationStatus(
  code: DerivableActivationCode,
  now: Date = new Date()
): ActivationCodeDerivedStatus {
  if (isCodeInvalidated(code)) return "invalidated";
  if (isCodeExpired(code, now)) return "expired";
  if (isCodeExhausted(code)) return "exhausted";
  return "active";
}

/** 剩余可用次数：null 表示不限次；0 表示已耗尽 */
export function deriveRemainingUses(code: DerivableActivationCode): number | null {
  const maxUses = toInt(code.max_uses);
  if (maxUses === null) return null;
  return Math.max(0, maxUses - (toInt(code.used_count) ?? 0));
}

/** 派生态中文标签，供管理端展示复用 */
export function getDerivedStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "可用";
    case "expired":
      return "已过期";
    case "exhausted":
      return "次数已用尽";
    case "invalidated":
      return "已作废";
    default:
      return "未知";
  }
}

/** 派生态 Tailwind 配色，供管理端展示复用 */
export function getDerivedStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "text-green-600 bg-green-100";
    case "expired":
      return "text-red-600 bg-red-100";
    case "exhausted":
      return "text-amber-700 bg-amber-100";
    case "invalidated":
      return "text-zinc-500 bg-zinc-100";
    default:
      return "text-zinc-500 bg-zinc-100";
  }
}

/** 持久态类型守卫 */
export function isPersistentStatus(value: string): value is ActivationCodePersistentStatus {
  return value === "active" || value === "invalidated";
}
