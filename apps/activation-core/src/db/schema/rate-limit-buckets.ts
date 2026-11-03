import { check, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 客户端接口频率限制计数（固定窗口）
 *
 * - 计数存于数据库而非进程内存，多实例 / Serverless 部署共享同一份限流状态
 * - bucket_key = "<限流前缀>:<身份 SHA-256>"，不落原始 IP / 设备标识
 * - expires_at 之后该窗口作废，下次请求重新从 1 计数；过期行可随时删除
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    bucketKey: varchar("bucket_key", { length: 128 }).primaryKey(),
    requestCount: integer("request_count").default(0).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_rate_limit_buckets_expires_at").on(table.expiresAt),
    check("rate_limit_buckets_request_count_check", sql`${table.requestCount} >= 0`),
    check(
      "rate_limit_buckets_window_check",
      sql`${table.expiresAt} > ${table.windowStartedAt}`
    ),
  ]
);
