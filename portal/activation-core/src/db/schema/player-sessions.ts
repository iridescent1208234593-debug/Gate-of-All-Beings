import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { activationCodes } from "./activation-codes";

/**
 * 玩家会话表（众生之门式会话态对齐）
 *
 * 会话是「登录态」，不是「码的副本」：
 * - 会话令牌仅存 SHA-256 摘要（session_token_hash），明文只在签发响应中出现一次
 * - 玩家在线 = status = 'active' 且 last_heartbeat_at 在心跳窗口内（派生，不落库）
 * - 会话结束/被踢只改会话，不删码、不删会话行（保留审计轨迹）
 */
export const PLAYER_SESSION_STATUSES = ["active", "ended", "kicked", "expired"] as const;

export type PlayerSessionStatus = (typeof PLAYER_SESSION_STATUSES)[number];

export const PLAYER_SESSION_END_REASONS = [
  "game_over",
  "logout",
  "heartbeat_timeout",
  "code_invalidated",
  "admin_kick",
  "resume_conflict",
  "expired",
] as const;

export type PlayerSessionEndReason = (typeof PLAYER_SESSION_END_REASONS)[number];

export const playerSessions = pgTable(
  "player_sessions",
  {
    id: serial("id").primaryKey(),
    /** 玩家 ID（与 bound_player_id 同源） */
    playerId: varchar("player_id", { length: 255 }).notNull(),
    nickname: varchar("nickname", { length: 100 }),
    /** 种族（可选项，仅作画像留档） */
    race: varchar("race", { length: 50 }),
    /** 来源激活码；事件码/管理密钥签发的会话为 NULL */
    activationCodeId: integer("activation_code_id").references(() => activationCodes.id, {
      onDelete: "set null",
    }),
    /** 是否经由事件访问码签发 */
    eventAccess: boolean("event_access").default(false).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    /** 会话尚可用次数：NULL = 不限次（事件码/管理密钥/不限次码） */
    remainingUses: integer("remaining_uses"),
    /** 会话令牌 SHA-256 摘要（64 位十六进制） */
    sessionTokenHash: varchar("session_token_hash", { length: 128 }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: varchar("end_reason", { length: 30 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("player_sessions_token_hash_unique_idx").on(table.sessionTokenHash),
    index("idx_player_sessions_player_id").on(table.playerId),
    index("idx_player_sessions_status").on(table.status),
    index("idx_player_sessions_player_status").on(table.playerId, table.status),
    index("idx_player_sessions_activation_code_id").on(table.activationCodeId),
    index("idx_player_sessions_last_heartbeat_at").on(table.lastHeartbeatAt),
    index("idx_player_sessions_issued_at").on(table.issuedAt),
    check(
      "player_sessions_status_check",
      sql`${table.status} in ('active', 'ended', 'kicked', 'expired')`
    ),
    check(
      "player_sessions_remaining_uses_check",
      sql`${table.remainingUses} is null or ${table.remainingUses} >= 0`
    ),
  ]
);
