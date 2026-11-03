import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clientChallenges, type ClientChallengeRoute } from "@/db/schema";

export type ClientChallengeConsumeResult = "consumed" | "expired" | "used" | "invalid";

export async function insertClientChallenge(input: {
  challengeHash: string;
  deviceId: string;
  route: ClientChallengeRoute;
  expiresAt: Date;
}): Promise<void> {
  await db.insert(clientChallenges).values({
    challengeHash: input.challengeHash,
    deviceId: input.deviceId,
    route: input.route,
    expiresAt: input.expiresAt,
  });
}

/**
 * 原子消费 challenge：同一 challenge 并发提交时只有一个请求能成功。
 * 失败时再查一次原因，便于客户端区分“过期 / 已用 / 无效（不存在、设备或接口不符）”。
 */
export async function consumeClientChallenge(input: {
  challengeHash: string;
  deviceId: string;
  route: ClientChallengeRoute;
}): Promise<ClientChallengeConsumeResult> {
  const consumed = await db.execute(sql`
    UPDATE client_challenges
    SET consumed_at = now()
    WHERE challenge_hash = ${input.challengeHash}
      AND device_id = ${input.deviceId}
      AND route = ${input.route}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING challenge_hash
  `);
  if (consumed.rows.length > 0) {
    return "consumed";
  }

  const existing = await db.execute(sql`
    SELECT device_id, route, consumed_at, (expires_at <= now()) AS is_expired
    FROM client_challenges
    WHERE challenge_hash = ${input.challengeHash}
  `);
  const row = existing.rows[0] as
    | { device_id: string; route: string; consumed_at: Date | null; is_expired: boolean }
    | undefined;
  if (!row || row.device_id !== input.deviceId || row.route !== input.route) {
    return "invalid";
  }
  if (row.consumed_at) {
    return "used";
  }
  return row.is_expired ? "expired" : "invalid";
}

/** 删除过期超过 retainMs 的 challenge，返回删除行数。 */
export async function deleteExpiredClientChallenges(retainMs: number): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM client_challenges
    WHERE expires_at <= now() - (${retainMs}::double precision * interval '1 millisecond')
  `);
  return result.rowCount ?? 0;
}
