import { NextRequest, NextResponse } from 'next/server';
import { endSession } from '@/server/activation';
import type { PlayerSessionEndReason } from '@/server/activation';

/**
 * 会话结算 API
 * POST /api/auth/session/end
 *
 * 请求体参数：
 * - session_token: 会话令牌（必填）
 * - reason: 结束原因（可选，默认 game_over）
 *   可选值：game_over / logout / heartbeat_timeout / code_invalidated / admin_kick / resume_conflict / expired
 */

const ALLOWED_REASONS: PlayerSessionEndReason[] = [
  'game_over',
  'logout',
  'heartbeat_timeout',
  'code_invalidated',
  'admin_kick',
  'resume_conflict',
  'expired'
];

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
    const rawReason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数：session_token' },
        { status: 400 }
      );
    }

    if (rawReason && !ALLOWED_REASONS.includes(rawReason as PlayerSessionEndReason)) {
      return NextResponse.json(
        {
          success: false,
          message: `reason 取值无效，可选：${ALLOWED_REASONS.join(' / ')}`
        },
        { status: 400 }
      );
    }

    const reason: PlayerSessionEndReason = rawReason
      ? (rawReason as PlayerSessionEndReason)
      : 'game_over';

    const result = await endSession(sessionToken, reason);

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        should_logout: result.shouldLogout,
        data: {
          transitioned: result.transitioned,
          remaining_uses: result.remainingUses,
          end_reason: reason
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('session/end API 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
