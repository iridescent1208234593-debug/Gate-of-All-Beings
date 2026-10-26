import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activationCodes } from "@/db/schema";
import { CURRENT_TIMESTAMP_SQL, DbTransaction, toNumber } from "./_shared";
import { kickSessionsByActivationCodeIdInTx } from "./player-session-repository";
import {
  deriveActivationStatus,
  deriveRemainingUses,
} from "@/lib/activation-code-status";
import type { ActivationCodeDerivedStatus } from "@/db/schema/activation-codes";

export interface ActivationCodeRecord {
  id: number;
  code: string;
  /** 持久状态（落库）：active | invalidated */
  status: "active" | "invalidated";
  /** 派生状态（读取时计算）：invalidated | expired | exhausted | active */
  derived_status: ActivationCodeDerivedStatus;
  expires_at: Date | null;
  used_at: Date | null;
  used_by_device_id: string | null;
  validity_days: number | null;
  max_uses: number | null;
  used_count: number;
  bound_player_id: string | null;
  bound_nickname: string | null;
  revoked_at: Date | null;
  revoked_by: string | null;
  last_used_at: Date | null;
  /** 剩余次数：null 表示不限次 */
  remaining_uses: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ActivationCodeListFilters {
  /** all | active | invalidated | expired | exhausted | unused(兼容旧前端) | used(兼容旧前端) */
  status?: string;
  search?: string;
  /** 仅未绑定（可导出分发）的码 */
  unboundOnly?: boolean;
  limit?: number;
  offset?: number;
}

/** 核销错误码（对齐众生之门 6 项业务错误） */
export const ACTIVATION_ERROR_CODES = {
  CODE_NOT_FOUND: "CODE_NOT_FOUND",
  CODE_EXPIRED: "CODE_EXPIRED",
  CODE_EXHAUSTED: "CODE_EXHAUSTED",
  CODE_INVALIDATED: "CODE_INVALIDATED",
  CODE_BOUND_OTHER: "CODE_BOUND_OTHER",
  DEVICE_ALREADY_ACTIVATED: "DEVICE_ALREADY_ACTIVATED",
} as const;

export type ActivationErrorCode =
  (typeof ACTIVATION_ERROR_CODES)[keyof typeof ACTIVATION_ERROR_CODES];

const ACTIVATION_ERROR_MESSAGES: Record<ActivationErrorCode, string> = {
  CODE_NOT_FOUND: "激活码不存在",
  CODE_EXPIRED: "激活码已过期",
  CODE_EXHAUSTED: "激活码使用次数已用尽",
  CODE_INVALIDATED: "激活码已被作废",
  CODE_BOUND_OTHER: "激活码已被其他玩家绑定",
  DEVICE_ALREADY_ACTIVATED: "该设备已有有效的激活码，每个设备只能同时使用一个激活码",
};

export interface RedeemActivationCodeInput {
  code: string;
  playerId: string;
  nickname?: string | null;
  deviceId?: string | null;
  /** true 表示本次为会话结算（Game Over / 主动退出），首次绑定不计数 */
  isSessionEnd?: boolean;
  /** 是否执行设备维度唯一性校验（设备侧接入默认 true，玩家侧接入传 false） */
  enforceDeviceUniqueness?: boolean;
}

export interface ActivationValidationResult {
  success: boolean;
  message: string;
  error_code?: ActivationErrorCode;
  activationCode?: ActivationCodeRecord;
  /** 结算后剩余次数：null 表示不限次 */
  remainingUses?: number | null;
  /** 是否应强制客户端登出（作废 / 次数耗尽） */
  shouldLogout?: boolean;
  /** 本次是否完成首玩家绑定 */
  isFirstRedeem?: boolean;
}

export interface ActivationCleanupStatsRecord {
  cleanableExpired: number;
  totalExpired: number;
  totalCodes: number;
  /** 兼容字段：未核销的可用码数 */
  unusedCodes: number;
  /** 兼容字段：已核销/已绑定的码数 */
  usedCodes: number;
}

export interface ActivationOverviewStatsRecord {
  totalCodes: number;
  /** 兼容字段：未核销的可用码数 */
  unusedCodes: number;
  /** 兼容字段：已核销/已绑定的码数 */
  usedCodes: number;
  expiredCodes: number;
  invalidatedCodes: number;
  exhaustedCodes: number;
  unboundCodes: number;
  boundPlayerCodes: number;
}

export interface ActivationDetailedStatsRecord {
  overview: {
    totalCodes: number;
    unusedCodes: number;
    usedCodes: number;
    expiredCodes: number;
    invalidatedCodes: number;
    exhaustedCodes: number;
    unboundCodes: number;
    boundPlayerCodes: number;
  };
  devices: {
    uniqueDevices: number;
    totalActivations: number;
    averageActivationsPerDevice: number;
  };
  expiry: {
    neverExpire: number;
    valid: number;
    expired: number;
  };
  recentCreated: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  activationTrend: Array<{
    date: string;
    activations: number;
  }>;
  hourlyActivations: Array<{
    hour: number;
    activations: number;
  }>;
}

interface LockedActivationCodeRow {
  id: number | string;
  code: string;
  status: string;
  expires_at: Date | string | null;
  used_at: Date | string | null;
  used_by_device_id: string | null;
  validity_days: number | string | null;
  max_uses: number | string | null;
  used_count: number | string | null;
  bound_player_id: string | null;
  bound_nickname: string | null;
  revoked_at: Date | string | null;
  revoked_by: string | null;
  last_used_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toStringOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value);
  return str.length === 0 ? null : str;
}

function withDerivedFields(
  base: Omit<ActivationCodeRecord, "derived_status" | "remaining_uses">
): ActivationCodeRecord {
  return {
    ...base,
    derived_status: deriveActivationStatus(base),
    remaining_uses: deriveRemainingUses(base),
  };
}

function mapActivationCodeRow(row: typeof activationCodes.$inferSelect): ActivationCodeRecord {
  return withDerivedFields({
    id: row.id,
    code: row.code,
    status: row.status as "active" | "invalidated",
    expires_at: row.expiresAt,
    used_at: row.usedAt,
    used_by_device_id: row.usedByDeviceId,
    validity_days: row.validityDays,
    max_uses: row.maxUses,
    used_count: row.usedCount ?? 0,
    bound_player_id: row.boundPlayerId,
    bound_nickname: row.boundNickname,
    revoked_at: row.revokedAt,
    revoked_by: row.revokedBy,
    last_used_at: row.lastUsedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  });
}

function mapLockedActivationCodeRow(row: LockedActivationCodeRow): ActivationCodeRecord {
  return withDerivedFields({
    id: Number(row.id),
    code: String(row.code),
    status: (row.status === "invalidated" ? "invalidated" : "active") as
      | "active"
      | "invalidated",
    expires_at: toDateOrNull(row.expires_at),
    used_at: toDateOrNull(row.used_at),
    used_by_device_id: toStringOrNull(row.used_by_device_id),
    validity_days: toNumberOrNull(row.validity_days),
    max_uses: toNumberOrNull(row.max_uses),
    used_count: toNumberOrNull(row.used_count) ?? 0,
    bound_player_id: toStringOrNull(row.bound_player_id),
    bound_nickname: toStringOrNull(row.bound_nickname),
    revoked_at: toDateOrNull(row.revoked_at),
    revoked_by: toStringOrNull(row.revoked_by),
    last_used_at: toDateOrNull(row.last_used_at),
    created_at: toDateOrNull(row.created_at) ?? new Date(),
    updated_at: toDateOrNull(row.updated_at) ?? new Date(),
  });
}

function activeActivationCondition() {
  return or(
    isNull(activationCodes.expiresAt),
    sql`${activationCodes.expiresAt} > CURRENT_TIMESTAMP`
  )!;
}

function expiredActivationCondition() {
  return and(
    isNotNull(activationCodes.expiresAt),
    sql`${activationCodes.expiresAt} <= CURRENT_TIMESTAMP`
  )!;
}

/** 未作废 */
function notRevokedCondition() {
  return isNull(activationCodes.revokedAt)!;
}

/** 未绑定（既无玩家也无设备） */
function unboundCondition() {
  return and(
    isNull(activationCodes.boundPlayerId),
    isNull(activationCodes.usedByDeviceId)
  )!;
}

/** 已绑定（玩家或设备任一） */
function boundCondition() {
  return or(
    isNotNull(activationCodes.boundPlayerId),
    isNotNull(activationCodes.usedByDeviceId)
  )!;
}

/** 次数已耗尽（max_uses 非空且 used_count >= max_uses） */
function exhaustedCondition() {
  return and(
    isNotNull(activationCodes.maxUses),
    sql`${activationCodes.usedCount} >= ${activationCodes.maxUses}`
  )!;
}

/** 未核销可用码：active + 未作废 + 未绑定 + 未过期 + 未耗尽 */
function unboundUsableCondition() {
  return and(
    eq(activationCodes.status, "active"),
    notRevokedCondition(),
    unboundCondition(),
    activeActivationCondition(),
    sql`(${activationCodes.maxUses} is null or ${activationCodes.usedCount} < ${activationCodes.maxUses})`
  )!;
}

/** 设备维度咨询锁：把「同一设备的核销」串行化，杜绝并发双码绕过 */
async function lockDeviceScope(tx: DbTransaction, deviceId: string): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`activation-device:${deviceId}`}))`
  );
}

async function lockActivationCodeByCode(
  tx: DbTransaction,
  code: string
): Promise<ActivationCodeRecord | null> {
  const result = await tx.execute(sql`
    SELECT id, code, status, expires_at, used_at, used_by_device_id, validity_days,
           max_uses, used_count, bound_player_id, bound_nickname,
           revoked_at, revoked_by, last_used_at, created_at, updated_at
    FROM activation_codes
    WHERE code = ${code}
    FOR UPDATE
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return mapLockedActivationCodeRow(result.rows[0] as unknown as LockedActivationCodeRow);
}

export async function listActivationCodes(
  filters?: ActivationCodeListFilters
): Promise<{ codes: ActivationCodeRecord[]; total: number }> {
  const conditions = [];

  const statusFilter = filters?.status;
  if (statusFilter && statusFilter !== "all") {
    switch (statusFilter) {
      case "active":
      case "invalidated":
        conditions.push(eq(activationCodes.status, statusFilter));
        break;
      case "expired":
        conditions.push(
          and(eq(activationCodes.status, "active"), expiredActivationCondition())!
        );
        break;
      case "exhausted":
        conditions.push(
          and(eq(activationCodes.status, "active"), exhaustedCondition())!
        );
        break;
      // 兼容旧前端：unused / used 映射为「未核销可用 / 已核销」
      case "unused":
        conditions.push(unboundUsableCondition());
        break;
      case "used":
        conditions.push(and(eq(activationCodes.status, "active"), boundCondition())!);
        break;
      default:
        break;
    }
  }

  if (filters?.unboundOnly) {
    conditions.push(unboundUsableCondition());
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(activationCodes.code, `%${filters.search}%`),
        ilike(activationCodes.usedByDeviceId, `%${filters.search}%`),
        ilike(activationCodes.boundPlayerId, `%${filters.search}%`),
        ilike(activationCodes.boundNickname, `%${filters.search}%`)
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const totalResult = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(activationCodes)
    .where(whereClause);

  let dataQuery = db
    .select()
    .from(activationCodes)
    .where(whereClause)
    .orderBy(desc(activationCodes.createdAt))
    .$dynamic();

  if (typeof filters?.limit === "number") {
    dataQuery = dataQuery.limit(filters.limit);
  }

  if (typeof filters?.offset === "number" && filters.offset > 0) {
    dataQuery = dataQuery.offset(filters.offset);
  }

  const rows = await dataQuery;

  return {
    codes: rows.map(mapActivationCodeRow),
    total: toNumber(totalResult[0]?.count),
  };
}

export async function listDeviceActivationHistory(deviceId: string): Promise<ActivationCodeRecord[]> {
  const rows = await db
    .select()
    .from(activationCodes)
    .where(eq(activationCodes.usedByDeviceId, deviceId))
    .orderBy(desc(activationCodes.usedAt));

  return rows.map(mapActivationCodeRow);
}

export async function findValidActivationByDevice(deviceId: string): Promise<ActivationCodeRecord | null> {
  const rows = await db
    .select()
    .from(activationCodes)
    .where(
      and(
        eq(activationCodes.usedByDeviceId, deviceId),
        eq(activationCodes.status, "active"),
        notRevokedCondition(),
        activeActivationCondition(),
        sql`(${activationCodes.maxUses} is null or ${activationCodes.usedCount} < ${activationCodes.maxUses})`
      )
    )
    .orderBy(desc(activationCodes.usedAt))
    .limit(1);

  return rows[0] ? mapActivationCodeRow(rows[0]) : null;
}

/** 按玩家查找仍有效的绑定码 */
export async function findValidActivationByPlayer(playerId: string): Promise<ActivationCodeRecord | null> {
  const rows = await db
    .select()
    .from(activationCodes)
    .where(
      and(
        eq(activationCodes.boundPlayerId, playerId),
        eq(activationCodes.status, "active"),
        notRevokedCondition(),
        activeActivationCondition(),
        sql`(${activationCodes.maxUses} is null or ${activationCodes.usedCount} < ${activationCodes.maxUses})`
      )
    )
    .orderBy(desc(activationCodes.lastUsedAt))
    .limit(1);

  return rows[0] ? mapActivationCodeRow(rows[0]) : null;
}

/** 按主键取单条码（会话结算时按 activation_code_id 反查） */
export async function findActivationCodeById(
  id: number
): Promise<ActivationCodeRecord | null> {
  const rows = await db
    .select()
    .from(activationCodes)
    .where(eq(activationCodes.id, id))
    .limit(1);

  return rows[0] ? mapActivationCodeRow(rows[0]) : null;
}

export async function countExpiredActivationsByDevice(deviceId: string): Promise<number> {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(activationCodes)
    .where(
      and(
        eq(activationCodes.usedByDeviceId, deviceId),
        eq(activationCodes.status, "active"),
        notRevokedCondition(),
        expiredActivationCondition()
      )
    );

  return toNumber(result[0]?.count);
}

export async function deleteActivationCodesByIds(ids: number[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const deletedRows = await db
    .delete(activationCodes)
    .where(inArray(activationCodes.id, ids))
    .returning({ id: activationCodes.id });

  return deletedRows.length;
}

export async function resetActivationCodesByIds(ids: number[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const updatedRows = await db
    .update(activationCodes)
    .set({
      status: "active",
      usedByDeviceId: null,
      usedAt: null,
      usedCount: 0,
      boundPlayerId: null,
      boundNickname: null,
      lastUsedAt: null,
      updatedAt: CURRENT_TIMESTAMP_SQL,
    })
    // 已作废（invalidated / revoked_at 非空）的码不可重置，语义上等价于永久失效
    .where(
      and(
        inArray(activationCodes.id, ids),
        eq(activationCodes.status, "active"),
        notRevokedCondition()
      )
    )
    .returning({ id: activationCodes.id });

  return updatedRows.length;
}

export async function resetValidActivationCodesByDevice(deviceId: string): Promise<number> {
  const updatedRows = await db
    .update(activationCodes)
    .set({
      status: "active",
      usedByDeviceId: null,
      usedAt: null,
      usedCount: 0,
      boundPlayerId: null,
      boundNickname: null,
      lastUsedAt: null,
      updatedAt: CURRENT_TIMESTAMP_SQL,
    })
    .where(
      and(
        eq(activationCodes.usedByDeviceId, deviceId),
        eq(activationCodes.status, "active"),
        notRevokedCondition(),
        activeActivationCondition()
      )
    )
    .returning({ id: activationCodes.id });

  return updatedRows.length;
}

export async function deleteExpiredUnusedActivationCodes(): Promise<number> {
  const deletedRows = await db
    .delete(activationCodes)
    .where(
      and(
        expiredActivationCondition(),
        eq(activationCodes.status, "active"),
        notRevokedCondition(),
        unboundCondition()
      )
    )
    .returning({ id: activationCodes.id });

  return deletedRows.length;
}

export async function getActivationCleanupStats(): Promise<ActivationCleanupStatsRecord> {
  const [cleanableExpiredResult, overview] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(activationCodes)
      .where(
        and(
          expiredActivationCondition(),
          eq(activationCodes.status, "active"),
          notRevokedCondition(),
          unboundCondition()
        )
      ),
    getActivationOverviewStats(),
  ]);

  return {
    cleanableExpired: toNumber(cleanableExpiredResult[0]?.count),
    totalExpired: overview.expiredCodes,
    totalCodes: overview.totalCodes,
    unusedCodes: overview.unusedCodes,
    usedCodes: overview.usedCodes,
  };
}

export async function getActivationOverviewStats(): Promise<ActivationOverviewStatsRecord> {
  const result = await db
    .select({
      totalCodes: sql<number>`count(*)`,
      unusedCodes: sql<number>`count(case when ${activationCodes.status} = 'active' and ${activationCodes.revokedAt} is null and ${activationCodes.boundPlayerId} is null and ${activationCodes.usedByDeviceId} is null and (${activationCodes.expiresAt} is null or ${activationCodes.expiresAt} > CURRENT_TIMESTAMP) and (${activationCodes.maxUses} is null or ${activationCodes.usedCount} < ${activationCodes.maxUses}) then 1 end)`,
      usedCodes: sql<number>`count(case when ${activationCodes.status} = 'active' and (${activationCodes.boundPlayerId} is not null or ${activationCodes.usedByDeviceId} is not null) then 1 end)`,
      expiredCodes: sql<number>`count(case when ${activationCodes.status} = 'active' and ${activationCodes.revokedAt} is null and ${activationCodes.expiresAt} is not null and ${activationCodes.expiresAt} <= CURRENT_TIMESTAMP then 1 end)`,
      invalidatedCodes: sql<number>`count(case when ${activationCodes.status} = 'invalidated' or ${activationCodes.revokedAt} is not null then 1 end)`,
      exhaustedCodes: sql<number>`count(case when ${activationCodes.status} = 'active' and ${activationCodes.revokedAt} is null and ${activationCodes.maxUses} is not null and ${activationCodes.usedCount} >= ${activationCodes.maxUses} then 1 end)`,
      unboundCodes: sql<number>`count(case when ${activationCodes.status} = 'active' and ${activationCodes.revokedAt} is null and ${activationCodes.boundPlayerId} is null and ${activationCodes.usedByDeviceId} is null then 1 end)`,
      boundPlayerCodes: sql<number>`count(case when ${activationCodes.boundPlayerId} is not null then 1 end)`,
    })
    .from(activationCodes);

  return {
    totalCodes: toNumber(result[0]?.totalCodes),
    unusedCodes: toNumber(result[0]?.unusedCodes),
    usedCodes: toNumber(result[0]?.usedCodes),
    expiredCodes: toNumber(result[0]?.expiredCodes),
    invalidatedCodes: toNumber(result[0]?.invalidatedCodes),
    exhaustedCodes: toNumber(result[0]?.exhaustedCodes),
    unboundCodes: toNumber(result[0]?.unboundCodes),
    boundPlayerCodes: toNumber(result[0]?.boundPlayerCodes),
  };
}

export async function getActivationDetailedStats(): Promise<ActivationDetailedStatsRecord> {
  const [
    overview,
    deviceStatsResult,
    expiryStatsResult,
    recentCreatedResult,
    activationTrendRows,
    hourlyActivationRows,
  ] = await Promise.all([
    getActivationOverviewStats(),
    db
      .select({
        uniqueDevices: sql<number>`count(distinct ${activationCodes.usedByDeviceId})`,
        totalActivations: sql<number>`count(*)`,
      })
      .from(activationCodes)
      .where(isNotNull(activationCodes.usedByDeviceId)),
    db
      .select({
        neverExpire: sql<number>`count(case when ${activationCodes.expiresAt} is null then 1 end)`,
        valid: sql<number>`count(case when ${activationCodes.expiresAt} > CURRENT_TIMESTAMP then 1 end)`,
        expired: sql<number>`count(case when ${activationCodes.expiresAt} is not null and ${activationCodes.expiresAt} <= CURRENT_TIMESTAMP then 1 end)`,
      })
      .from(activationCodes),
    db
      .select({
        today: sql<number>`count(case when ${activationCodes.createdAt} >= CURRENT_DATE then 1 end)`,
        thisWeek: sql<number>`count(case when ${activationCodes.createdAt} >= CURRENT_DATE - INTERVAL '7 days' then 1 end)`,
        thisMonth: sql<number>`count(case when ${activationCodes.createdAt} >= CURRENT_DATE - INTERVAL '30 days' then 1 end)`,
      })
      .from(activationCodes),
    db
      .select({
        date: sql<string>`DATE(${activationCodes.usedAt})::text`,
        activations: sql<number>`count(*)`,
      })
      .from(activationCodes)
      .where(
        and(
          isNotNull(activationCodes.usedAt),
          sql`${activationCodes.usedAt} >= CURRENT_DATE - INTERVAL '30 days'`
        )
      )
      .groupBy(sql`DATE(${activationCodes.usedAt})`)
      .orderBy(desc(sql`DATE(${activationCodes.usedAt})`))
      .limit(30),
    db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${activationCodes.usedAt})::int`,
        activations: sql<number>`count(*)`,
      })
      .from(activationCodes)
      .where(
        and(
          isNotNull(activationCodes.usedAt),
          sql`DATE(${activationCodes.usedAt}) = CURRENT_DATE`
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${activationCodes.usedAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${activationCodes.usedAt})`),
  ]);

  const deviceStats = deviceStatsResult[0];
  const expiryStats = expiryStatsResult[0];
  const recentCreated = recentCreatedResult[0];

  const uniqueDevices = toNumber(deviceStats?.uniqueDevices);
  const totalActivations = toNumber(deviceStats?.totalActivations);
  const hourlyActivationsByHour = new Map(
    hourlyActivationRows.map((row) => [toNumber(row.hour), toNumber(row.activations)])
  );

  return {
    overview,
    devices: {
      uniqueDevices,
      totalActivations,
      averageActivationsPerDevice: uniqueDevices > 0 ? totalActivations / uniqueDevices : 0,
    },
    expiry: {
      neverExpire: toNumber(expiryStats?.neverExpire),
      valid: toNumber(expiryStats?.valid),
      expired: toNumber(expiryStats?.expired),
    },
    recentCreated: {
      today: toNumber(recentCreated?.today),
      thisWeek: toNumber(recentCreated?.thisWeek),
      thisMonth: toNumber(recentCreated?.thisMonth),
    },
    activationTrend: activationTrendRows
      .map((row) => ({
        date: String(row.date),
        activations: toNumber(row.activations),
      }))
      .reverse(),
    hourlyActivations: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      activations: hourlyActivationsByHour.get(hour) ?? 0,
    })),
  };
}

export async function insertActivationCodes(
  codes: Array<{
    code: string;
    expires_at?: Date | null;
    validity_days?: number | null;
    max_uses?: number | null;
  }>
): Promise<ActivationCodeRecord[]> {
  const rows = await db
    .insert(activationCodes)
    .values(
      codes.map((item) => ({
        code: item.code,
        expiresAt: item.expires_at ?? null,
        validityDays: item.validity_days ?? null,
        maxUses: item.max_uses ?? null,
      }))
    )
    .returning();

  return rows.map(mapActivationCodeRow);
}

export async function resetActivationCodeById(codeId: number): Promise<boolean> {
  const rows = await db
    .update(activationCodes)
    .set({
      status: "active",
      usedByDeviceId: null,
      usedAt: null,
      usedCount: 0,
      boundPlayerId: null,
      boundNickname: null,
      lastUsedAt: null,
      updatedAt: CURRENT_TIMESTAMP_SQL,
    })
    .where(
      and(
        eq(activationCodes.id, codeId),
        eq(activationCodes.status, "active"),
        notRevokedCondition()
      )
    )
    .returning({ id: activationCodes.id });

  return rows.length > 0;
}

function failResult(
  errorCode: ActivationErrorCode,
  extra?: Partial<ActivationValidationResult>
): ActivationValidationResult {
  return {
    success: false,
    message: ACTIVATION_ERROR_MESSAGES[errorCode],
    error_code: errorCode,
    ...extra,
  };
}

/**
 * 核销 / 校验激活码（7 步固化判定顺序）
 *
 * 1) 行锁：SELECT ... FOR UPDATE 锁住目标码（设备维唯一性在锁内由咨询锁串行化）
 * 2) 作废：status = 'invalidated' 或 revoked_at 非空 → CODE_INVALIDATED
 * 3) 过期：expires_at <= now → CODE_EXPIRED（不再附加 validity_days 为空前提，修复既有缺陷）
 * 4) 绑定冲突：首绑玩家后仅该玩家可用；已绑其他玩家/设备 → CODE_BOUND_OTHER
 * 5) 次数耗尽：max_uses 非空且 used_count >= max_uses → CODE_EXHAUSTED
 * 6) 首次绑定：写入 bound_player_id / bound_nickname / used_by_device_id / used_at，
 *    并按 validity_days 计算有效期起点；首次绑定不计数
 * 7) 会话结算：isSessionEnd = true 时 used_count + 1、刷新 last_used_at，
 *    结算至上限时返回 shouldLogout = true
 */
export async function redeemActivationCode(
  input: RedeemActivationCodeInput
): Promise<ActivationValidationResult> {
  const code = (input.code ?? "").trim();
  const playerId = (input.playerId ?? "").trim();
  const nickname = input.nickname?.trim() ? input.nickname.trim() : null;
  const deviceId = input.deviceId?.trim() ? input.deviceId.trim() : null;
  const isSessionEnd = input.isSessionEnd === true;
  const enforceDeviceUniqueness = input.enforceDeviceUniqueness !== false;

  if (!code) {
    return failResult(ACTIVATION_ERROR_CODES.CODE_NOT_FOUND);
  }

  if (!playerId) {
    return { success: false, message: "玩家标识缺失" };
  }

  return await db.transaction(async (tx) => {
    // 0) 设备维度唯一性：先取设备咨询锁，再做占用检查，保证「检查 + 写入」原子
    if (enforceDeviceUniqueness && deviceId) {
      await lockDeviceScope(tx, deviceId);

      const occupyingRows = await tx
        .select({ code: activationCodes.code })
        .from(activationCodes)
        .where(
          and(
            eq(activationCodes.usedByDeviceId, deviceId),
            eq(activationCodes.status, "active"),
            notRevokedCondition(),
            activeActivationCondition(),
            sql`(${activationCodes.maxUses} is null or ${activationCodes.usedCount} < ${activationCodes.maxUses})`
          )
        )
        .orderBy(desc(activationCodes.usedAt))
        .limit(1);

      if (occupyingRows.length > 0 && occupyingRows[0].code !== code) {
        return failResult(ACTIVATION_ERROR_CODES.DEVICE_ALREADY_ACTIVATED);
      }
    }

    // 1) 行锁
    const activationCode = await lockActivationCodeByCode(tx, code);

    if (!activationCode) {
      return failResult(ACTIVATION_ERROR_CODES.CODE_NOT_FOUND);
    }

    // 2) 作废
    if (activationCode.status === "invalidated" || activationCode.revoked_at) {
      return failResult(ACTIVATION_ERROR_CODES.CODE_INVALIDATED, { shouldLogout: true });
    }

    // 3) 过期（不再附加 validity_days 为空前提）
    if (activationCode.expires_at && activationCode.expires_at.getTime() <= Date.now()) {
      return failResult(ACTIVATION_ERROR_CODES.CODE_EXPIRED, { shouldLogout: true });
    }

    // 4) 绑定冲突
    const boundPlayerId = activationCode.bound_player_id;
    const boundDeviceId = activationCode.used_by_device_id;
    const isFirstRedeem = !boundPlayerId && !boundDeviceId;

    if (boundPlayerId && boundPlayerId !== playerId) {
      return failResult(ACTIVATION_ERROR_CODES.CODE_BOUND_OTHER);
    }

    if (boundDeviceId && deviceId && boundDeviceId !== deviceId) {
      return failResult(ACTIVATION_ERROR_CODES.CODE_BOUND_OTHER);
    }

    if (boundDeviceId && !deviceId && !boundPlayerId) {
      // 该码已绑定设备但本次未携带设备标识，无法证明是同一台设备
      return failResult(ACTIVATION_ERROR_CODES.CODE_BOUND_OTHER);
    }

    // 5) 次数耗尽
    const maxUses = activationCode.max_uses;
    const usedCount = activationCode.used_count;
    if (maxUses !== null && usedCount >= maxUses) {
      return failResult(ACTIVATION_ERROR_CODES.CODE_EXHAUSTED, { shouldLogout: true });
    }

    // 6) 首次绑定（不计数）
    const now = new Date();
    let calculatedExpiresAt = activationCode.expires_at;
    if (activationCode.validity_days !== null && !calculatedExpiresAt) {
      calculatedExpiresAt = new Date(
        now.getTime() + activationCode.validity_days * 24 * 60 * 60 * 1000
      );
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: CURRENT_TIMESTAMP_SQL,
      status: "active",
    };

    if (isFirstRedeem) {
      updatePayload.boundPlayerId = playerId;
      updatePayload.boundNickname = nickname;
      if (deviceId) {
        updatePayload.usedByDeviceId = deviceId;
      }
      updatePayload.usedAt = CURRENT_TIMESTAMP_SQL;
      updatePayload.lastUsedAt = CURRENT_TIMESTAMP_SQL;
      updatePayload.expiresAt = calculatedExpiresAt;
    }

    // 7) 会话结算（计数）
    let nextUsedCount = usedCount;
    let shouldLogout = false;

    if (!isFirstRedeem && isSessionEnd) {
      nextUsedCount = usedCount + 1;
      updatePayload.usedCount = nextUsedCount;
      updatePayload.lastUsedAt = CURRENT_TIMESTAMP_SQL;
      if (!calculatedExpiresAt && activationCode.validity_days !== null) {
        updatePayload.expiresAt = calculatedExpiresAt;
      }
      if (maxUses !== null && nextUsedCount >= maxUses) {
        shouldLogout = true;
      }
    }

    if (isFirstRedeem) {
      updatePayload.usedCount = nextUsedCount;
    }

    const updatedRows = await tx
      .update(activationCodes)
      .set(updatePayload)
      .where(eq(activationCodes.id, activationCode.id))
      .returning();

    const updatedActivationCode = updatedRows[0]
      ? mapActivationCodeRow(updatedRows[0])
      : ({
          ...activationCode,
          status: "active" as const,
          derived_status: activationCode.derived_status,
          used_count: nextUsedCount,
          bound_player_id: isFirstRedeem ? playerId : activationCode.bound_player_id,
          bound_nickname: isFirstRedeem ? nickname : activationCode.bound_nickname,
          used_by_device_id: isFirstRedeem ? deviceId : activationCode.used_by_device_id,
          expires_at: calculatedExpiresAt,
        } satisfies ActivationCodeRecord);

    const remainingUses = deriveRemainingUses(updatedActivationCode);

    return {
      success: true,
      message: isFirstRedeem
        ? "激活成功，激活码已绑定当前玩家"
        : isSessionEnd
          ? "会话已结算"
          : "校验通过",
      activationCode: updatedActivationCode,
      remainingUses,
      shouldLogout,
      isFirstRedeem,
    };
  });
}

/**
 * 作废激活码（永久失效，不可重置）：同时踢出仍在该码下的活跃会话
 */
export async function invalidateActivationCodesByIds(
  ids: number[],
  revokedBy: string
): Promise<{ invalidated: number; kickedSessions: number; codes: string[] }> {
  if (ids.length === 0) {
    return { invalidated: 0, kickedSessions: 0, codes: [] };
  }

  return await db.transaction(async (tx) => {
    const rows = await tx
      .update(activationCodes)
      .set({
        status: "invalidated",
        revokedAt: CURRENT_TIMESTAMP_SQL,
        revokedBy,
        updatedAt: CURRENT_TIMESTAMP_SQL,
      })
      .where(inArray(activationCodes.id, ids))
      .returning({ id: activationCodes.id, code: activationCodes.code });

    let kickedSessions = 0;
    for (const row of rows) {
      kickedSessions += await kickSessionsByActivationCodeIdInTx(
        tx,
        row.id,
        "code_invalidated"
      );
    }

    return {
      invalidated: rows.length,
      kickedSessions,
      codes: rows.map((row) => row.code),
    };
  });
}

export async function invalidateActivationCodeByCode(
  code: string,
  revokedBy: string
): Promise<{ invalidated: number; kickedSessions: number }> {
  const target = (code ?? "").trim();
  if (!target) {
    return { invalidated: 0, kickedSessions: 0 };
  }

  const rows = await db
    .select({ id: activationCodes.id })
    .from(activationCodes)
    .where(eq(activationCodes.code, target))
    .limit(1);

  if (rows.length === 0) {
    return { invalidated: 0, kickedSessions: 0 };
  }

  const result = await invalidateActivationCodesByIds([rows[0].id], revokedBy);
  return { invalidated: result.invalidated, kickedSessions: result.kickedSessions };
}

/** 导出用：按条件取全量码（不做分页） */
export async function listActivationCodesForExport(
  filters?: ActivationCodeListFilters
): Promise<ActivationCodeRecord[]> {
  const { codes } = await listActivationCodes({
    ...filters,
    limit: undefined,
    offset: undefined,
  });
  return codes;
}

/** 备份用：全量码（snake_case 原始字段，含派生态） */
export async function listActivationCodesForBackup(limit: number = 10000) {
  const rows = await db.select().from(activationCodes).orderBy(activationCodes.id).limit(limit);
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    derived_status: deriveActivationStatus({
      status: row.status,
      expires_at: row.expiresAt,
      revoked_at: row.revokedAt,
      max_uses: row.maxUses,
      used_count: row.usedCount,
    }),
    expires_at: row.expiresAt,
    used_at: row.usedAt,
    used_by_device_id: row.usedByDeviceId,
    validity_days: row.validityDays,
    max_uses: row.maxUses,
    used_count: row.usedCount ?? 0,
    bound_player_id: row.boundPlayerId,
    bound_nickname: row.boundNickname,
    revoked_at: row.revokedAt,
    revoked_by: row.revokedBy,
    last_used_at: row.lastUsedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }));
}
