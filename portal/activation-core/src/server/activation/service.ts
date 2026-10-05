import {
  type ActivationCodeRecord,
  type ActivationCleanupStatsRecord,
  type ActivationDetailedStatsRecord,
  type ActivationValidationResult,
  type RedeemActivationCodeInput,
  type PlayerSessionDetailRecord,
  countExpiredActivationsByDevice,
  countOnlinePlayerSessions,
  createPlayerSession,
  deleteActivationCodesByIds,
  deleteExpiredUnusedActivationCodes,
  endPlayerSession,
  findActivationCodeById,
  findPlayerSessionByToken,
  findValidActivationByDevice,
  getActivationCleanupStats as getActivationCleanupStatsFromRepository,
  getActivationDetailedStats as getActivationDetailedStatsFromRepository,
  getActivationOverviewStats as getActivationOverviewStatsFromRepository,
  getPlayerSessionOverview as getPlayerSessionOverviewFromRepository,
  insertActivationCodes,
  invalidateActivationCodeByCode,
  invalidateActivationCodesByIds,
  kickSessionsByPlayerId,
  listActivationCodes,
  listActivationCodesForBackup,
  listActivationCodesForExport,
  listDeviceActivationHistory,
  listPlayerSessions,
  listPlayerSessionsForBackup,
  redeemActivationCode,
  resetActivationCodesByIds,
  resetActivationCodeById,
  resetValidActivationCodesByDevice,
  resumePlayerSession,
  touchPlayerSessionHeartbeat,
  updateSessionRemainingUses,
  type PlayerSessionEndReason,
} from "@/db/repositories";

export type ActivationCode = ActivationCodeRecord;
export type ActivationCleanupStats = ActivationCleanupStatsRecord;
export type ActivationDetailedStats = ActivationDetailedStatsRecord;
export type ActivationRedeemResult = ActivationValidationResult;
export type PlayerSessionDetail = PlayerSessionDetailRecord;
export type { PlayerSessionEndReason };

export async function createActivationCodes(
  codes: Array<{
    code: string;
    expires_at?: Date | null;
    validity_days?: number | null;
    max_uses?: number | null;
  }>
): Promise<ActivationCode[]> {
  return await insertActivationCodes(codes);
}

export async function batchDeleteActivationCodes(ids: number[]): Promise<number> {
  return await deleteActivationCodesByIds(ids);
}

export async function batchResetActivationCodes(ids: number[]): Promise<number> {
  return await resetActivationCodesByIds(ids);
}

export async function getActivationCodes(filters?: {
  status?: string;
  search?: string;
  unboundOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ codes: ActivationCode[]; total: number }> {
  return await listActivationCodes(filters);
}

/**
 * 核销 / 校验激活码（玩家侧与设备侧统一入口）
 */
export async function redeemCode(
  input: RedeemActivationCodeInput
): Promise<ActivationRedeemResult> {
  return await redeemActivationCode(input);
}

/**
 * 兼容入口：设备侧核销（保留旧调用签名，内部走 7 步判定）
 */
export async function validateActivationCode(
  code: string,
  deviceId: string,
  playerId?: string
): Promise<ActivationRedeemResult> {
  return await redeemActivationCode({
    code,
    deviceId,
    playerId: playerId?.trim() ? playerId.trim() : `device:${deviceId}`,
    enforceDeviceUniqueness: true,
  });
}

export async function resetDeviceValidActivations(deviceId: string): Promise<number> {
  return await resetValidActivationCodesByDevice(deviceId);
}

export async function getDeviceActivationHistory(deviceId: string): Promise<ActivationCode[]> {
  return await listDeviceActivationHistory(deviceId);
}

export async function checkDeviceActivationStatus(deviceId: string): Promise<{
  isActivated: boolean;
  activationCode?: ActivationCode;
  hasExpiredActivations?: boolean;
}> {
  const [activationCode, expiredActivationCount] = await Promise.all([
    findValidActivationByDevice(deviceId),
    countExpiredActivationsByDevice(deviceId),
  ]);
  const hasExpiredActivations = expiredActivationCount > 0;

  if (!activationCode) {
    return {
      isActivated: false,
      hasExpiredActivations,
    };
  }

  return {
    isActivated: true,
    activationCode,
    hasExpiredActivations,
  };
}

export async function cleanupExpiredUnusedCodes(): Promise<number> {
  return await deleteExpiredUnusedActivationCodes();
}

export async function getActivationCleanupStats(): Promise<ActivationCleanupStats> {
  return await getActivationCleanupStatsFromRepository();
}

export async function getActivationStats(): Promise<{
  total: number;
  unused: number;
  used: number;
  expired: number;
}> {
  const stats = await getActivationOverviewStatsFromRepository();

  return {
    total: stats.totalCodes,
    unused: stats.unusedCodes,
    used: stats.usedCodes,
    expired: stats.expiredCodes,
  };
}

export async function getDetailedActivationStats(): Promise<ActivationDetailedStats> {
  return await getActivationDetailedStatsFromRepository();
}

export async function resetActivationCode(codeId: number): Promise<boolean> {
  return await resetActivationCodeById(codeId);
}

/** 作废激活码（永久失效）并踢出该码下的活跃会话 */
export async function invalidateCodes(
  ids: number[],
  revokedBy: string
): Promise<{ invalidated: number; kickedSessions: number; codes: string[] }> {
  return await invalidateActivationCodesByIds(ids, revokedBy);
}

export async function invalidateCode(
  code: string,
  revokedBy: string
): Promise<{ invalidated: number; kickedSessions: number }> {
  return await invalidateActivationCodeByCode(code, revokedBy);
}

/** 导出：按条件取全量码 */
export async function exportActivationCodes(filters?: {
  status?: string;
  search?: string;
  unboundOnly?: boolean;
}): Promise<ActivationCode[]> {
  return await listActivationCodesForExport(filters);
}

/** 备份：全量码原始行 + 全量会话行 */
export async function backupActivationData(): Promise<{
  activation_codes: Awaited<ReturnType<typeof listActivationCodesForBackup>>;
  player_sessions: Awaited<ReturnType<typeof listPlayerSessionsForBackup>>;
}> {
  const [codes, sessions] = await Promise.all([
    listActivationCodesForBackup(),
    listPlayerSessionsForBackup(),
  ]);

  return { activation_codes: codes, player_sessions: sessions };
}

export interface IssuedSessionPayload {
  session_token: string;
  player_id: string;
  nickname: string | null;
  race: string | null;
  event_access: boolean;
  remaining_uses: number | null;
  expires_at: Date | null;
  is_first_redeem: boolean;
  issued_at: Date;
}

export interface IssueSessionResult {
  success: boolean;
  message: string;
  error_code?: string;
  shouldLogout?: boolean;
  data?: IssuedSessionPayload;
}

/**
 * 玩家码通道：核销激活码 → 签发会话（一码绑首玩家）
 */
export async function issueSessionByActivationCode(input: {
  code: string;
  playerId: string;
  nickname?: string | null;
  race?: string | null;
}): Promise<IssueSessionResult> {
  const redeemResult = await redeemActivationCode({
    code: input.code,
    playerId: input.playerId,
    nickname: input.nickname ?? null,
    isSessionEnd: false,
    // 玩家通道不做设备维度唯一性限制：码绑玩家，玩家可换设备
    enforceDeviceUniqueness: false,
  });

  if (!redeemResult.success || !redeemResult.activationCode) {
    return {
      success: false,
      message: redeemResult.message,
      error_code: redeemResult.error_code,
      shouldLogout: redeemResult.shouldLogout,
    };
  }

  const activationCode = redeemResult.activationCode;

  const { session, token } = await createPlayerSession({
    playerId: input.playerId,
    nickname: input.nickname ?? activationCode.bound_nickname,
    race: input.race ?? null,
    activationCodeId: activationCode.id,
    eventAccess: false,
    remainingUses: redeemResult.remainingUses ?? null,
  });

  return {
    success: true,
    message: redeemResult.message,
    data: {
      session_token: token,
      player_id: session.player_id,
      nickname: session.nickname,
      race: session.race,
      event_access: session.event_access,
      remaining_uses: session.remaining_uses,
      expires_at: activationCode.expires_at,
      is_first_redeem: redeemResult.isFirstRedeem === true,
      issued_at: session.issued_at,
    },
  };
}

/**
 * 事件码 / 管理密钥通道：签发不限次会话（不消耗任何激活码）
 */
export async function issueEventAccessSession(input: {
  playerId: string;
  nickname?: string | null;
  race?: string | null;
}): Promise<IssueSessionResult> {
  const { session, token } = await createPlayerSession({
    playerId: input.playerId,
    nickname: input.nickname ?? null,
    race: input.race ?? null,
    activationCodeId: null,
    eventAccess: true,
    remainingUses: null,
  });

  return {
    success: true,
    message: "事件访问会话已签发",
    data: {
      session_token: token,
      player_id: session.player_id,
      nickname: session.nickname,
      race: session.race,
      event_access: true,
      remaining_uses: null,
      expires_at: null,
      is_first_redeem: false,
      issued_at: session.issued_at,
    },
  };
}

/** 会话心跳：续活并回传剩余次数 / 是否需要登出 */
export async function heartbeatSession(sessionToken: string): Promise<{
  success: boolean;
  message: string;
  shouldLogout: boolean;
  data?: {
    player_id: string;
    event_access: boolean;
    remaining_uses: number | null;
    last_heartbeat_at: Date;
  };
}> {
  const { session, activated } = await touchPlayerSessionHeartbeat(sessionToken);

  if (!session) {
    return { success: false, message: "会话不存在", shouldLogout: true };
  }

  if (!activated) {
    return {
      success: false,
      message: "会话已失效，请重新登录",
      shouldLogout: true,
    };
  }

  return {
    success: true,
    message: "心跳已续活",
    shouldLogout: false,
    data: {
      player_id: session.player_id,
      event_access: session.event_access,
      remaining_uses: session.remaining_uses,
      last_heartbeat_at: session.last_heartbeat_at,
    },
  };
}

/**
 * 会话结算：结束会话 + 码侧计数（仅首次迁移结算，天然防重复扣次）
 */
export async function endSession(
  sessionToken: string,
  endReason: PlayerSessionEndReason = "game_over"
): Promise<{
  success: boolean;
  message: string;
  transitioned: boolean;
  shouldLogout: boolean;
  remainingUses: number | null;
  error_code?: string;
}> {
  const { session, transitioned } = await endPlayerSession(sessionToken, endReason);

  if (!session) {
    return {
      success: false,
      message: "会话不存在",
      transitioned: false,
      shouldLogout: true,
      remainingUses: null,
    };
  }

  if (!transitioned) {
    return {
      success: true,
      message: "会话已结束（无需重复结算）",
      transitioned: false,
      shouldLogout: true,
      remainingUses: session.remaining_uses,
    };
  }

  if (!session.activation_code_id) {
    return {
      success: true,
      message: "会话已结束",
      transitioned: true,
      shouldLogout: true,
      remainingUses: null,
    };
  }

  const activationCode = await findActivationCodeById(session.activation_code_id);
  if (!activationCode) {
    return {
      success: true,
      message: "会话已结束",
      transitioned: true,
      shouldLogout: true,
      remainingUses: null,
    };
  }

  const settleResult = await redeemActivationCode({
    code: activationCode.code,
    playerId: session.player_id,
    nickname: session.nickname,
    isSessionEnd: true,
    enforceDeviceUniqueness: false,
  });

  const remainingUses = settleResult.success
    ? (settleResult.remainingUses ?? null)
    : 0;

  await updateSessionRemainingUses(session.id, remainingUses);

  return {
    success: settleResult.success,
    message: settleResult.success ? "会话已结算" : settleResult.message,
    transitioned: true,
    shouldLogout: settleResult.shouldLogout === true || remainingUses === 0,
    remainingUses,
    error_code: settleResult.error_code,
  };
}

/** 会话续接：令牌与玩家一致且会话仍 active 才有效 */
export async function resumeSession(
  playerId: string,
  sessionToken: string | null | undefined
): Promise<{
  success: boolean;
  message: string;
  shouldLogout: boolean;
  data?: {
    player_id: string;
    event_access: boolean;
    remaining_uses: number | null;
    issued_at: Date;
  };
}> {
  const { session, valid } = await resumePlayerSession(playerId, sessionToken);

  if (!session || !valid) {
    return {
      success: false,
      message: "会话不可续接，请重新登录",
      shouldLogout: true,
    };
  }

  return {
    success: true,
    message: "会话已续接",
    shouldLogout: false,
    data: {
      player_id: session.player_id,
      event_access: session.event_access,
      remaining_uses: session.remaining_uses,
      issued_at: session.issued_at,
    },
  };
}

export async function getSessionByToken(sessionToken: string) {
  return await findPlayerSessionByToken(sessionToken);
}

/** 管理端：玩家会话列表 */
export async function getPlayerSessions(options?: {
  onlineOnly?: boolean;
  limit?: number;
}): Promise<PlayerSessionDetail[]> {
  return await listPlayerSessions(options);
}

/** 管理端：强制下线某玩家 */
export async function kickPlayer(playerId: string): Promise<number> {
  return await kickSessionsByPlayerId(playerId, "admin_kick");
}

/** 管理端：会话概览 */
export async function getPlayerSessionStats(): Promise<{
  totalSessions: number;
  onlineSessions: number;
  activeSessions: number;
  endedSessions: number;
  kickedSessions: number;
}> {
  const overview = await getPlayerSessionOverviewFromRepository();
  const onlineSessions = await countOnlinePlayerSessions();

  return { ...overview, onlineSessions };
}

