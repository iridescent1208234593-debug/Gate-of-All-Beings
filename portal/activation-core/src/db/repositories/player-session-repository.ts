/**
 * 玩家会话仓储（众生之门式会话态）
 *
 * 设计要点：
 * - 令牌明文不落库，只存 SHA-256 摘要
 * - 玩家在线为派生态：status = 'active' 且 last_heartbeat_at 落在心跳窗口内
 * - 会话结束/踢出为一次性状态迁移（UPDATE ... WHERE status = 'active'），天然幂等
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { activationCodes, playerSessions } from "@/db/schema";
import { CURRENT_TIMESTAMP_SQL, DbTransaction, toNumber } from "./_shared";

/** 会话令牌熵：32 字节随机数（hex 编码，64 字符） */
export const PLAYER_SESSION_TOKEN_BYTES = 32;

/** 心跳窗口（秒）：超过该窗口未心跳即视为离线 */
export const PLAYER_SESSION_ONLINE_WINDOW_SECONDS = 90;

export interface PlayerSessionRecord {
  id: number;
  player_id: string;
  nickname: string | null;
  race: string | null;
  activation_code_id: number | null;
  event_access: boolean;
  status: "active" | "ended" | "kicked" | "expired";
  remaining_uses: number | null;
  session_token_hash: string;
  issued_at: Date;
  last_heartbeat_at: Date;
  ended_at: Date | null;
  end_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlayerSessionDetailRecord extends PlayerSessionRecord {
  code: string | null;
  is_online: boolean;
}

export type PlayerSessionEndReason =
  | "game_over"
  | "logout"
  | "heartbeat_timeout"
  | "code_invalidated"
  | "admin_kick"
  | "resume_conflict"
  | "expired";

/** 生成会话令牌明文（仅在签发响应中返回一次） */
export function generateSessionToken(): string {
  return randomBytes(PLAYER_SESSION_TOKEN_BYTES).toString("hex");
}

/** 会话令牌摘要（SHA-256 hex） */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function mapSessionRow(row: typeof playerSessions.$inferSelect): PlayerSessionRecord {
  return {
    id: row.id,
    player_id: row.playerId,
    nickname: row.nickname,
    race: row.race,
    activation_code_id: row.activationCodeId,
    event_access: row.eventAccess,
    status: row.status as PlayerSessionRecord["status"],
    remaining_uses: row.remainingUses,
    session_token_hash: row.sessionTokenHash,
    issued_at: row.issuedAt,
    last_heartbeat_at: row.lastHeartbeatAt,
    ended_at: row.endedAt,
    end_reason: row.endReason,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

/** 在线判定：active 且心跳未超窗口 */
export function isSessionOnline(
  session: Pick<PlayerSessionRecord, "status" | "last_heartbeat_at">,
  now: Date = new Date()
): boolean {
  if (session.status !== "active") return false;
  const last = session.last_heartbeat_at instanceof Date
    ? session.last_heartbeat_at
    : new Date(session.last_heartbeat_at);
  if (Number.isNaN(last.getTime())) return false;
  return now.getTime() - last.getTime() <= PLAYER_SESSION_ONLINE_WINDOW_SECONDS * 1000;
}

function onlineCondition() {
  return and(
    eq(playerSessions.status, "active"),
    sql`${playerSessions.lastHeartbeatAt} > CURRENT_TIMESTAMP - INTERVAL '${sql.raw(
      String(PLAYER_SESSION_ONLINE_WINDOW_SECONDS)
    )} seconds'`
  );
}

export async function createPlayerSession(input: {
  playerId: string;
  nickname?: string | null;
  race?: string | null;
  activationCodeId?: number | null;
  eventAccess?: boolean;
  remainingUses?: number | null;
}): Promise<{ session: PlayerSessionRecord; token: string }> {
  const token = generateSessionToken();
  const rows = await db
    .insert(playerSessions)
    .values({
      playerId: input.playerId,
      nickname: input.nickname ?? null,
      race: input.race ?? null,
      activationCodeId: input.activationCodeId ?? null,
      eventAccess: input.eventAccess ?? false,
      remainingUses: input.remainingUses ?? null,
      sessionTokenHash: hashSessionToken(token),
      status: "active",
    })
    .returning();

  return { session: mapSessionRow(rows[0]), token };
}

export async function findPlayerSessionByToken(token: string): Promise<PlayerSessionRecord | null> {
  const rows = await db
    .select()
    .from(playerSessions)
    .where(eq(playerSessions.sessionTokenHash, hashSessionToken(token)))
    .limit(1);

  return rows[0] ? mapSessionRow(rows[0]) : null;
}

/** 心跳续活：仅 active 会话可续活，返回续活后的会话 */
export async function touchPlayerSessionHeartbeat(
  token: string
): Promise<{ session: PlayerSessionRecord | null; activated: boolean }> {
  const rows = await db
    .update(playerSessions)
    .set({
      lastHeartbeatAt: CURRENT_TIMESTAMP_SQL,
      updatedAt: CURRENT_TIMESTAMP_SQL,
    })
    .where(
      and(
        eq(playerSessions.sessionTokenHash, hashSessionToken(token)),
        eq(playerSessions.status, "active")
      )
    )
    .returning();

  if (rows.length > 0) {
    return { session: mapSessionRow(rows[0]), activated: true };
  }

  const existing = await findPlayerSessionByToken(token);
  return { session: existing, activated: false };
}

/**
 * 结束会话（一次性状态迁移）
 * - 返回 transitioned=true 表示本次调用完成了 active → ended 迁移（调用方据此决定是否结算次数）
 * - 重复调用返回 transitioned=false，避免重复扣次
 */
export async function endPlayerSession(
  token: string,
  endReason: PlayerSessionEndReason
): Promise<{ session: PlayerSessionRecord | null; transitioned: boolean }> {
  const rows = await db
    .update(playerSessions)
    .set({
      status: "ended",
      endedAt: CURRENT_TIMESTAMP_SQL,
      endReason,
      updatedAt: CURRENT_TIMESTAMP_SQL,
    })
    .where(
      and(
        eq(playerSessions.sessionTokenHash, hashSessionToken(token)),
        eq(playerSessions.status, "active")
      )
    )
    .returning();

  if (rows.length > 0) {
    return { session: mapSessionRow(rows[0]), transitioned: true };
  }

  const existing = await findPlayerSessionByToken(token);
  return { session: existing, transitioned: false };
}

/** 会话结算后同步剩余次数（由核销流程调用） */
export async function updateSessionRemainingUses(
  sessionId: number,
  remainingUses: number | null
): Promise<void> {
  await db
    .update(playerSessions)
    .set({
      remainingUses,
      updatedAt: CURRENT_TIMESTAMP_SQL,
    })
    .where(eq(playerSessions.id, sessionId));
}

/** 续接会话：同玩家且令牌匹配且会话仍 active 才有效 */
export async function resumePlayerSession(
  playerId: string,
  token: string | null | undefined
): Promise<{ session: PlayerSessionRecord | null; valid: boolean }> {
  const rows = await db
    .select()
    .from(playerSessions)
    .where(and(eq(playerSessions.playerId, playerId), eq(playerSessions.status, "active")))
    .orderBy(desc(playerSessions.issuedAt))
    .limit(1);

  const session = rows[0] ? mapSessionRow(rows[0]) : null;
  if (!session) return { session: null, valid: false };
  if (!token) return { session, valid: false };

  return { session, valid: session.session_token_hash === hashSessionToken(token) };
}

/** 按激活码踢出会话（事务内版本，供作废流程原子调用） */
export async function kickSessionsByActivationCodeIdInTx(
  tx: DbTransaction,
  activationCodeId: number,
  endReason: PlayerSessionEndReason = "code_invalidated"
): Promise<number> {
  const rows = await tx
    .update(playerSessions)
    .set({
      status: "kicked",
      endedAt: CURRENT_TIMESTAMP_SQL,
      endReason,
      updatedAt: CURRENT_TIMESTAMP_SQL,
    })
    .where(
      and(
        eq(playerSessions.activationCodeId, activationCodeId),
        eq(playerSessions.status, "active")
      )
    )
    .returning({ id: playerSessions.id });

  return rows.length;
}

/** 按玩家踢出会话（管理端强制下线） */
export async function kickSessionsByPlayerId(
  playerId: string,
  endReason: PlayerSessionEndReason = "admin_kick"
): Promise<number> {
  const rows = await db
    .update(playerSessions)
    .set({
      status: "kicked",
      endedAt: CURRENT_TIMESTAMP_SQL,
      endReason,
      updatedAt: CURRENT_TIMESTAMP_SQL,
    })
    .where(and(eq(playerSessions.playerId, playerId), eq(playerSessions.status, "active")))
    .returning({ id: playerSessions.id });

  return rows.length;
}

/** 管理端玩家会话列表（可只看在线） */
export async function listPlayerSessions(options?: {
  onlineOnly?: boolean;
  limit?: number;
}): Promise<PlayerSessionDetailRecord[]> {
  const conditions = [];
  if (options?.onlineOnly) {
    conditions.push(onlineCondition());
  }

  const rows = await db
    .select({
      session: playerSessions,
      code: activationCodes.code,
    })
    .from(playerSessions)
    .leftJoin(activationCodes, eq(playerSessions.activationCodeId, activationCodes.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(playerSessions.lastHeartbeatAt))
    .limit(options?.limit ?? 200);

  return rows.map((row) => {
    const session = mapSessionRow(row.session);
    return {
      ...session,
      code: row.code ?? null,
      is_online: isSessionOnline(session),
    };
  });
}

/** 在线玩家数（心跳窗口内） */
export async function countOnlinePlayerSessions(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(playerSessions)
    .where(onlineCondition());

  return toNumber(result[0]?.count);
}

/** 会话总数 / 在线数 / 结束数概览 */
export async function getPlayerSessionOverview(): Promise<{
  totalSessions: number;
  onlineSessions: number;
  activeSessions: number;
  endedSessions: number;
  kickedSessions: number;
}> {
  const result = await db
    .select({
      totalSessions: sql<number>`count(*)`,
      activeSessions: sql<number>`count(case when ${playerSessions.status} = 'active' then 1 end)`,
      onlineSessions: sql<number>`count(case when ${playerSessions.status} = 'active' and ${playerSessions.lastHeartbeatAt} > CURRENT_TIMESTAMP - INTERVAL '${sql.raw(
        String(PLAYER_SESSION_ONLINE_WINDOW_SECONDS)
      )} seconds' then 1 end)`,
      endedSessions: sql<number>`count(case when ${playerSessions.status} = 'ended' then 1 end)`,
      kickedSessions: sql<number>`count(case when ${playerSessions.status} = 'kicked' then 1 end)`,
    })
    .from(playerSessions);

  return {
    totalSessions: toNumber(result[0]?.totalSessions),
    onlineSessions: toNumber(result[0]?.onlineSessions),
    activeSessions: toNumber(result[0]?.activeSessions),
    endedSessions: toNumber(result[0]?.endedSessions),
    kickedSessions: toNumber(result[0]?.kickedSessions),
  };
}

/** 备份用：全量会话（snake_case 原始字段，含令牌摘要，不含明文） */
export async function listPlayerSessionsForBackup(limit: number = 10000) {
  const rows = await db.select().from(playerSessions).orderBy(playerSessions.id).limit(limit);
  return rows.map(mapSessionRow);
}
