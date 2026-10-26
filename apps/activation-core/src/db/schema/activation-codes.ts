import { check, index, integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 持久状态（落库，仅两态）：
 * - active：可用/在用（含未核销、已核销未作废、未过期、未耗尽）
 * - invalidated：已作废（永久失效，不可重置/不可复用）
 *
 * 派生状态（不落库，读取时计算，见 src/lib/activation-code-status.ts）：
 * - expired：expires_at 已到
 * - exhausted：max_uses 非空且 used_count >= max_uses
 */
export const ACTIVATION_CODE_PERSISTENT_STATUSES = ["active", "invalidated"] as const;

export type ActivationCodePersistentStatus = (typeof ACTIVATION_CODE_PERSISTENT_STATUSES)[number];

export type ActivationCodeDerivedStatus =
  | ActivationCodePersistentStatus
  | "expired"
  | "exhausted";

export const activationCodes = pgTable(
  "activation_codes",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedByDeviceId: varchar("used_by_device_id", { length: 255 }),
    validityDays: integer("validity_days"),
    // ==== 众生之门式码规则扩展字段（由迁移 0001 引入） ====
    /** 可用次数上限；NULL = 不限次（存量码迁移后固定为 NULL） */
    maxUses: integer("max_uses"),
    /** 已结算次数（仅在会话结算时递增，同玩家重复进入不递增） */
    usedCount: integer("used_count").default(0).notNull(),
    /** 首玩家绑定 ID；NULL = 未绑定（唯一一张有效牌副本） */
    boundPlayerId: varchar("bound_player_id", { length: 255 }),
    /** 首玩家昵称 */
    boundNickname: varchar("bound_nickname", { length: 100 }),
    /** 作废时间（非空即视为永久失效） */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** 作废操作者（admin 用户名或 admin-key） */
    revokedBy: varchar("revoked_by", { length: 50 }),
    /** 最近一次结算时间 */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_activation_codes_code").on(table.code),
    uniqueIndex("activation_codes_code_unique_idx").on(table.code),
    index("idx_activation_codes_status").on(table.status),
    index("idx_activation_codes_expires_at").on(table.expiresAt),
    index("idx_activation_codes_device_id").on(table.usedByDeviceId),
    index("idx_activation_codes_created_at").on(table.createdAt),
    index("idx_activation_codes_validity_days").on(table.validityDays),
    index("idx_activation_codes_bound_player_id").on(table.boundPlayerId),
    index("idx_activation_codes_max_uses").on(table.maxUses),
    check("activation_codes_status_check", sql`${table.status} in ('active', 'invalidated')`),
    check(
      "activation_codes_validity_days_check",
      sql`${table.validityDays} is null or ${table.validityDays} > 0`
    ),
    check(
      "activation_codes_max_uses_check",
      sql`${table.maxUses} is null or ${table.maxUses} >= 1`
    ),
    check("activation_codes_used_count_check", sql`${table.usedCount} >= 0`),
  ]
);
