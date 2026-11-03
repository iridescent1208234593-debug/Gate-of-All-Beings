import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export interface RateLimitBucketState {
  request_count: number;
  expires_at: Date;
}

interface RateLimitBucketRow {
  request_count: number | string;
  expires_at: Date | string;
}

/**
 * 原子地为限流键计一次请求并返回当前窗口状态。
 *
 * 单条 INSERT ... ON CONFLICT DO UPDATE：并发请求在同一行上串行化，
 * 多个应用实例共享同一数据库时计数一致。窗口已过期则从 1 重新计数。
 */
export async function incrementRateLimitBucket(
  bucketKey: string,
  windowMs: number
): Promise<RateLimitBucketState> {
  const windowSql = sql`(${windowMs}::double precision * interval '1 millisecond')`;
  const result = await db.execute(sql`
    INSERT INTO rate_limit_buckets AS bucket (bucket_key, request_count, window_started_at, expires_at)
    VALUES (${bucketKey}, 1, now(), now() + ${windowSql})
    ON CONFLICT (bucket_key) DO UPDATE SET
      request_count = CASE WHEN bucket.expires_at <= now() THEN 1 ELSE bucket.request_count + 1 END,
      window_started_at = CASE WHEN bucket.expires_at <= now() THEN now() ELSE bucket.window_started_at END,
      expires_at = CASE WHEN bucket.expires_at <= now() THEN EXCLUDED.expires_at ELSE bucket.expires_at END,
      updated_at = now()
    RETURNING request_count, expires_at
  `);

  const row = result.rows[0] as unknown as RateLimitBucketRow;
  return {
    request_count: Number(row.request_count),
    expires_at: row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at)),
  };
}

/** 删除已过期的限流窗口，返回删除行数。 */
export async function deleteExpiredRateLimitBuckets(): Promise<number> {
  const result = await db.execute(sql`DELETE FROM rate_limit_buckets WHERE expires_at <= now()`);
  return result.rowCount ?? 0;
}
