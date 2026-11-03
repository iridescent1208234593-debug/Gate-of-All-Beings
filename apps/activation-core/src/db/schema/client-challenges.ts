import { check, index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** 一次性 challenge 可用于的客户端接口 */
export const CLIENT_CHALLENGE_ROUTES = ["/api/client/verify", "/api/client/activate"] as const;

export type ClientChallengeRoute = (typeof CLIENT_CHALLENGE_ROUTES)[number];

/**
 * 客户端一次性 challenge（响应签名防重放）
 *
 * - 由 POST /api/client/challenge 签发，绑定 device_id 与目标接口，短时有效
 * - 只存 SHA-256 摘要（challenge_hash），明文只在签发响应中出现一次
 * - verify / activate 用单条 UPDATE 原子消费：consumed_at 为空且未过期才成功，
 *   签发的 license_token 把 challenge 写进 nonce，客户端据此拒绝旧响应
 */
export const clientChallenges = pgTable(
  "client_challenges",
  {
    challengeHash: varchar("challenge_hash", { length: 64 }).primaryKey(),
    deviceId: varchar("device_id", { length: 255 }).notNull(),
    route: varchar("route", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_client_challenges_expires_at").on(table.expiresAt),
    check(
      "client_challenges_route_check",
      sql`${table.route} in ('/api/client/verify', '/api/client/activate')`
    ),
    check("client_challenges_window_check", sql`${table.expiresAt} > ${table.createdAt}`),
  ]
);
