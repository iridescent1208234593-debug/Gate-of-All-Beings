import { NextRequest, NextResponse } from 'next/server';
import { issueSessionByActivationCode, issueEventAccessSession } from '@/server/activation';
import { cleanActivationCode, isValidActivationCodeFormat, formatDateTimeForAPI } from '@/lib/utils';
import { checkRateLimit, getClientIP, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { extractAdminKey, isValidAdminKey, isValidEventAccessCode } from '@/lib/admin-key';

/**
 * 处理预检请求
 * OPTIONS /api/auth/verify-code
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, User-Agent',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * 统一入口校验 / 登入 API（众生之门式三态分发）
 * POST /api/auth/verify-code
 *
 * 分发优先级：
 * 1) X-Admin-Key 请求头 → 管理密钥通道：签发不限次事件会话
 * 2) event_code 请求体字段 → 事件码通道：签发不限次事件会话
 * 3) code 请求体字段 → 玩家码通道：核销激活码并签发会话（一码绑首玩家）
 *
 * 请求体参数：
 * - code: 玩家激活码（通道三）
 * - event_code: 事件访问码（通道二）
 * - player_id: 玩家标识（必填）
 * - nickname: 玩家昵称（可选）
 * - race: 玩家种族（可选）
 */
export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: '请求体格式错误' },
        { status: 400 }
      );
    }

    const rawCode = typeof body.code === 'string' ? body.code : '';
    const rawEventCode = typeof body.event_code === 'string' ? body.event_code : '';
    const playerId = typeof body.player_id === 'string' ? body.player_id.trim() : '';
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : null;
    const race = typeof body.race === 'string' ? body.race.trim() : null;

    if (!playerId) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数：player_id' },
        { status: 400 }
      );
    }

    if (playerId.length < 3 || playerId.length > 255) {
      return NextResponse.json(
        { success: false, message: '玩家标识格式不正确' },
        { status: 400 }
      );
    }

    const adminKey = extractAdminKey(request);
    const hasAdminKey = Boolean(adminKey);
    const hasEventCode = rawEventCode.length > 0;
    const hasActivationCode = rawCode.length > 0;

    if (!hasAdminKey && !hasEventCode && !hasActivationCode) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必要参数：code / event_code / X-Admin-Key 三者需提供其一'
        },
        { status: 400 }
      );
    }

    // ===== 频率限制（IP / 玩家 / 全局） =====
    const ipRateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIGS.VERIFY_IP);
    if (ipRateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          message: `请求过于频繁，请在 ${Math.ceil(ipRateLimit.resetTimeMs / 1000)} 秒后重试`,
          retryAfter: Math.ceil(ipRateLimit.resetTimeMs / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(ipRateLimit.resetTimeMs / 1000).toString(),
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.VERIFY_IP.maxRequests.toString(),
            'X-RateLimit-Remaining': ipRateLimit.remaining.toString(),
            'X-RateLimit-Reset': ipRateLimit.resetTime.toString()
          }
        }
      );
    }

    const playerRateLimit = checkRateLimit(playerId, RATE_LIMIT_CONFIGS.VERIFY_DEVICE);
    if (playerRateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          message: `请求过于频繁，请在 ${Math.ceil(playerRateLimit.resetTimeMs / 1000)} 秒后重试`,
          retryAfter: Math.ceil(playerRateLimit.resetTimeMs / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(playerRateLimit.resetTimeMs / 1000).toString(),
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.VERIFY_DEVICE.maxRequests.toString(),
            'X-RateLimit-Remaining': playerRateLimit.remaining.toString()
          }
        }
      );
    }

    const globalRateLimit = checkRateLimit('global', RATE_LIMIT_CONFIGS.VERIFY_GLOBAL);
    if (globalRateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          message: '系统繁忙，请稍后重试',
          retryAfter: Math.ceil(globalRateLimit.resetTimeMs / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(globalRateLimit.resetTimeMs / 1000).toString()
          }
        }
      );
    }

    const responseHeaders = {
      'X-RateLimit-IP-Remaining': ipRateLimit.remaining.toString(),
      'X-RateLimit-Player-Remaining': playerRateLimit.remaining.toString()
    };

    // ===== 通道一：管理密钥 =====
    if (hasAdminKey) {
      if (!isValidAdminKey(adminKey)) {
        console.log(`❌ 管理密钥校验失败 (IP: ${clientIP})`);
        return NextResponse.json(
          { success: false, message: '管理密钥无效' },
          { status: 401 }
        );
      }

      const issued = await issueEventAccessSession({ playerId, nickname, race });

      console.log(`✅ 管理密钥通道签发会话: ${playerId} (IP: ${clientIP})`);

      return NextResponse.json(
        {
          success: true,
          message: issued.message,
          channel: 'admin_key',
          data: formatIssuedSession(issued.data)
        },
        { status: 200, headers: responseHeaders }
      );
    }

    // ===== 通道二：事件码 =====
    if (hasEventCode) {
      if (!isValidEventAccessCode(rawEventCode.trim())) {
        console.log(`❌ 事件码校验失败 (IP: ${clientIP})`);
        return NextResponse.json(
          { success: false, message: '事件访问码无效', error_code: 'EVENT_CODE_INVALID' },
          { status: 401 }
        );
      }

      const issued = await issueEventAccessSession({ playerId, nickname, race });

      console.log(`✅ 事件码通道签发会话: ${playerId} (IP: ${clientIP})`);

      return NextResponse.json(
        {
          success: true,
          message: issued.message,
          channel: 'event_code',
          data: formatIssuedSession(issued.data)
        },
        { status: 200, headers: responseHeaders }
      );
    }

    // ===== 通道三：玩家激活码 =====
    const cleanCode = cleanActivationCode(rawCode);
    if (!isValidActivationCodeFormat(cleanCode)) {
      return NextResponse.json(
        { success: false, message: '激活码格式不正确' },
        { status: 400 }
      );
    }

    const issued = await issueSessionByActivationCode({
      code: cleanCode,
      playerId,
      nickname,
      race
    });

    if (!issued.success) {
      console.log(
        `❌ 激活码登入失败: ${cleanCode} -> 玩家 ${playerId} (IP: ${clientIP}) - ${issued.message}`
      );

      return NextResponse.json(
        {
          success: false,
          message: issued.message,
          error_code: issued.error_code,
          should_logout: issued.shouldLogout === true
        },
        { status: 400 }
      );
    }

    console.log(`✅ 激活码通道签发会话: ${cleanCode} -> 玩家 ${playerId} (IP: ${clientIP})`);

    return NextResponse.json(
      {
        success: true,
        message: issued.message,
        channel: 'activation_code',
        data: formatIssuedSession(issued.data)
      },
      { status: 200, headers: responseHeaders }
    );

  } catch (error) {
    console.error('verify-code API 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}

interface IssuedSessionLike {
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

function formatIssuedSession(data?: IssuedSessionLike) {
  if (!data) return null;

  return {
    session_token: data.session_token,
    player_id: data.player_id,
    nickname: data.nickname,
    race: data.race,
    event_access: data.event_access,
    remaining_uses: data.remaining_uses,
    expires_at: formatDateTimeForAPI(data.expires_at),
    is_first_redeem: data.is_first_redeem,
    issued_at: formatDateTimeForAPI(data.issued_at)
  };
}
