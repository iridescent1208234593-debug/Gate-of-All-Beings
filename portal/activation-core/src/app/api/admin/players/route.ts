import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/admin-guard';
import { getPlayerSessions, getPlayerSessionStats, kickPlayer } from '@/server/activation';
import { formatDateTimeForAPI, formatDurationForAPI } from '@/lib/utils';

/**
 * 玩家会话管理 API
 * GET    /api/admin/players?online_only=&limit=   —— 会话列表 + 概览
 * DELETE /api/admin/players?player_id=xxx        —— 强制下线指定玩家
 *
 * 鉴权：X-Admin-Key 或 JWT Cookie
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminAccess(request);

    if (!access.ok) {
      return NextResponse.json(
        { success: false, message: access.message ?? '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const onlineOnly = searchParams.get('online_only') === 'true';
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 1000
      ? limitParam
      : 200;

    const [sessions, stats] = await Promise.all([
      getPlayerSessions({ onlineOnly, limit }),
      getPlayerSessionStats()
    ]);

    return NextResponse.json(
      {
        success: true,
        message: `共 ${sessions.length} 条会话记录`,
        data: {
          online_only: onlineOnly,
          limit,
          stats,
          sessions: sessions.map((session) => ({
            id: session.id,
            player_id: session.player_id,
            nickname: session.nickname,
            race: session.race,
            event_access: session.event_access,
            activation_code_id: session.activation_code_id,
            status: session.status,
            online: session.is_online,
            code: session.code,
            remaining_uses: session.remaining_uses,
            end_reason: session.end_reason,
            issued_at: formatDateTimeForAPI(session.issued_at),
            last_heartbeat_at: formatDateTimeForAPI(session.last_heartbeat_at),
            ended_at: formatDateTimeForAPI(session.ended_at),
            online_duration: formatDurationForAPI(session.issued_at, session.ended_at)
          }))
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('admin/players GET 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireAdminAccess(request);

    if (!access.ok) {
      return NextResponse.json(
        { success: false, message: access.message ?? '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('player_id')?.trim() || '';

    if (!playerId) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数：player_id' },
        { status: 400 }
      );
    }

    const kicked = await kickPlayer(playerId);

    return NextResponse.json(
      {
        success: true,
        message: kicked > 0
          ? `已强制下线玩家 ${playerId} 的 ${kicked} 个会话`
          : `玩家 ${playerId} 当前无活跃会话`,
        data: {
          player_id: playerId,
          kicked_sessions: kicked,
          operator: access.username ?? 'unknown'
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('admin/players DELETE 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
