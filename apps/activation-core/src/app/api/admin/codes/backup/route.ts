import { NextRequest, NextResponse } from 'next/server';
import { withAdminAccess } from '@/lib/admin-guard';
import { backupActivationData } from '@/server/activation';
import { formatDateTimeForAPI } from '@/lib/utils';

/**
 * 数据备份 API
 * GET /api/admin/codes/backup
 *
 * 鉴权：X-Admin-Key 或 JWT Cookie
 * 返回：activation_codes 与 player_sessions 两张表的全量原始行（含已作废/已结束记录），
 *      用于离线备份与灾后恢复；不含任何密钥信息。
 */
export const GET = withAdminAccess(async (request: NextRequest, _context, access) => {
  try {
    const backup = await backupActivationData();
    const backedUpAt = new Date();

    return NextResponse.json(
      {
        success: true,
        message: `备份完成：${backup.activation_codes.length} 条激活码 / ${backup.player_sessions.length} 条会话`,
        data: {
          backed_up_at: formatDateTimeForAPI(backedUpAt),
          operator: access.username ?? 'unknown',
          schema_version: 2,
          counts: {
            activation_codes: backup.activation_codes.length,
            player_sessions: backup.player_sessions.length
          },
          activation_codes: backup.activation_codes.map((code) => ({
            id: code.id,
            code: code.code,
            status: code.status,
            expires_at: formatDateTimeForAPI(code.expires_at),
            used_at: formatDateTimeForAPI(code.used_at),
            used_by_device_id: code.used_by_device_id,
            validity_days: code.validity_days,
            max_uses: code.max_uses,
            used_count: code.used_count,
            bound_player_id: code.bound_player_id,
            bound_nickname: code.bound_nickname,
            revoked_at: formatDateTimeForAPI(code.revoked_at),
            revoked_by: code.revoked_by,
            last_used_at: formatDateTimeForAPI(code.last_used_at),
            created_at: formatDateTimeForAPI(code.created_at),
            updated_at: formatDateTimeForAPI(code.updated_at)
          })),
          player_sessions: backup.player_sessions.map((session) => ({
            id: session.id,
            player_id: session.player_id,
            nickname: session.nickname,
            race: session.race,
            event_access: session.event_access,
            activation_code_id: session.activation_code_id,
            status: session.status,
            remaining_uses: session.remaining_uses,
            end_reason: session.end_reason,
            issued_at: formatDateTimeForAPI(session.issued_at),
            last_heartbeat_at: formatDateTimeForAPI(session.last_heartbeat_at),
            ended_at: formatDateTimeForAPI(session.ended_at),
            created_at: formatDateTimeForAPI(session.created_at),
            updated_at: formatDateTimeForAPI(session.updated_at)
          }))
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('codes/backup API 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
});
