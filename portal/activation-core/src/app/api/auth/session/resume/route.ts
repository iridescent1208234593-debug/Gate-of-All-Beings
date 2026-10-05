import { NextRequest, NextResponse } from 'next/server';
import { resumeSession } from '@/server/activation';
import { formatDateTimeForAPI } from '@/lib/utils';

/**
 * 会话续接 API
 * POST /api/auth/session/resume
 *
 * 请求体参数：
 * - player_id: 玩家标识（必填）
 * - session_token: 会话令牌（必填，需与该玩家的活跃会话一致）
 */

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: '请求体格式错误' },
        { status: 400 }
      );
    }

    const playerId = typeof body.player_id === 'string' ? body.player_id.trim() : '';
    const sessionToken = typeof body.session_token === 'string' ? body.session_token.trim() : '';

    if (!playerId || !sessionToken) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数：player_id 和 session_token' },
        { status: 400 }
      );
    }

    const result = await resumeSession(playerId, sessionToken);

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        should_logout: result.shouldLogout,
        data: result.data
          ? {
              player_id: result.data.player_id,
              event_access: result.data.event_access,
              remaining_uses: result.data.remaining_uses,
              issued_at: formatDateTimeForAPI(result.data.issued_at)
            }
          : null
      },
      { status: result.success ? 200 : 401 }
    );

  } catch (error) {
    console.error('session/resume API 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
