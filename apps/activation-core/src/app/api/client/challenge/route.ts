import { NextRequest, NextResponse } from 'next/server';
import { getClientApiKey } from '@/lib/server-credentials';
import { formatDateTimeForAPI } from '@/lib/utils';
import { checkRateLimit, getClientIP, RATE_LIMIT_CONFIGS, toRateLimitIpKey, type RateLimitResult } from '@/lib/rate-limit';
import { assertResponseSigningReady } from '@/lib/signing';
import {
  CLIENT_CHALLENGE_TTL_SECONDS,
  isClientChallengeRoute,
  issueClientChallenge,
  signingUnavailableResponse
} from '@/lib/client-challenge';

/**
 * 处理预检请求
 * OPTIONS /api/client/challenge
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, User-Agent',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function rateLimitedResponse(result: RateLimitResult, message: string) {
  const retryAfter = Math.ceil(result.resetTimeMs / 1000);
  return NextResponse.json(
    { success: false, message, retryAfter },
    { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
  );
}

/**
 * 签发一次性 challenge
 * POST /api/client/challenge
 *
 * 请求体：{ device_id, route }，route 为 "/api/client/verify" 或 "/api/client/activate"
 * 响应：{ challenge, route, expires_at, ttl_seconds }；challenge 只能用于该设备、该接口一次
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = getClientApiKey();

    if (!expectedApiKey) {
      console.error('CLIENT_API_KEY 环境变量未配置');
      return NextResponse.json({ success: false, message: '服务配置错误' }, { status: 500 });
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { success: false, message: '未授权访问，请提供有效的 API Key' },
        { status: 401 }
      );
    }

    // 无法签名时不发 challenge，客户端立即得到明确的配置错误
    try {
      await assertResponseSigningReady();
    } catch (error) {
      return signingUnavailableResponse(error);
    }

    const clientIP = getClientIP(request);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: '请求体格式错误' }, { status: 400 });
    }

    const deviceId = body.device_id;
    const route = body.route;

    if (typeof deviceId !== 'string' || deviceId.length < 3 || deviceId.length > 255) {
      return NextResponse.json({ success: false, message: '设备标识格式不正确' }, { status: 400 });
    }

    if (!isClientChallengeRoute(route)) {
      return NextResponse.json(
        { success: false, message: 'route 必须是 /api/client/verify 或 /api/client/activate' },
        { status: 400 }
      );
    }

    const ipRateLimit = await checkRateLimit(toRateLimitIpKey(clientIP), RATE_LIMIT_CONFIGS.CHALLENGE_IP);
    if (ipRateLimit.limited) {
      return rateLimitedResponse(ipRateLimit, `请求过于频繁，请在 ${Math.ceil(ipRateLimit.resetTimeMs / 1000)} 秒后重试`);
    }

    const deviceRateLimit = await checkRateLimit(deviceId, RATE_LIMIT_CONFIGS.CHALLENGE_DEVICE);
    if (deviceRateLimit.limited) {
      return rateLimitedResponse(deviceRateLimit, `该设备请求过于频繁，请在 ${Math.ceil(deviceRateLimit.resetTimeMs / 1000)} 秒后重试`);
    }

    const globalRateLimit = await checkRateLimit('global', RATE_LIMIT_CONFIGS.CHALLENGE_GLOBAL);
    if (globalRateLimit.limited) {
      return rateLimitedResponse(globalRateLimit, '系统繁忙，请稍后重试');
    }

    const { challenge, expiresAt } = await issueClientChallenge(deviceId, route);

    return NextResponse.json(
      {
        success: true,
        data: {
          challenge,
          route,
          expires_at: formatDateTimeForAPI(expiresAt),
          ttl_seconds: CLIENT_CHALLENGE_TTL_SECONDS
        }
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('challenge 签发失败:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, message: '服务暂时不可用，请稍后重试' }, { status: 500 });
  }
}
