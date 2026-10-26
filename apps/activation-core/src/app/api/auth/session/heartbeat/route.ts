import { NextRequest, NextResponse } from 'next/server';
import { heartbeatSession } from '@/server/activation';
import { formatDateTimeForAPI } from '@/lib/utils';

/**
 * 会话心跳 API
 * POST /api/auth/session/heartbeat
 *
 * 请求体参数：
 * - session_token: 会话令牌（必填）
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

    const sessionToken = typeof body.session_token === 'string' ? body.session_token.trim() : '';

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数：session_token' },
        { status: 400 }
      );
    }

    const result = await heartbeatSession(sessionToken);

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
              last_heartbeat_at: formatDateTimeForAPI(result.data.last_heartbeat_at)
            }
          : null
      },
      { status: result.success ? 200 : 401 }
    );

  } catch (error) {
    console.error('session/heartbeat API 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
