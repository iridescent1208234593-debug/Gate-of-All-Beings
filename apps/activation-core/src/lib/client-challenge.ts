/**
 * 客户端一次性 challenge（#45 M15：防重放状态由服务端登记并消费）
 *
 * 流程：
 * 1. 客户端 POST /api/client/challenge { device_id, route } 取得 challenge（60 秒有效）
 * 2. 客户端带 challenge 调用 route；服务端原子消费，过期 / 已用 / 设备或接口不符一律拒绝
 * 3. 服务端把 challenge 写进 license_token 的 nonce；客户端只接受 nonce 等于自己刚申请的
 *    challenge 的签名响应，所以截获的旧响应无法重放，且不依赖客户端时钟或本地缓存
 */

import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { CLIENT_CHALLENGE_ROUTES, type ClientChallengeRoute } from '@/db/schema/client-challenges';
import {
  consumeClientChallenge as consumeClientChallengeRow,
  deleteExpiredClientChallenges,
  insertClientChallenge,
  type ClientChallengeConsumeResult,
} from '@/db/repositories/client-challenge-repository';
import { SigningConfigError } from '@/lib/signing';

export const CLIENT_CHALLENGE_TTL_SECONDS = 60;

/** 32 字节随机数的 base64url 编码（43 字符） */
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** 过期 challenge 保留一小时便于返回“已过期”而不是“无效”，之后清理 */
const EXPIRED_CHALLENGE_RETAIN_MS = 60 * 60 * 1000;
const EXPIRED_CHALLENGE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastExpiredChallengeCleanupAt = 0;

export function isClientChallengeRoute(value: unknown): value is ClientChallengeRoute {
  return typeof value === 'string' && (CLIENT_CHALLENGE_ROUTES as readonly string[]).includes(value);
}

function hashChallenge(challenge: string): string {
  return createHash('sha256').update(challenge, 'utf8').digest('hex');
}

function cleanupExpiredChallengesInBackground() {
  const now = Date.now();
  if (now - lastExpiredChallengeCleanupAt < EXPIRED_CHALLENGE_CLEANUP_INTERVAL_MS) {
    return;
  }
  lastExpiredChallengeCleanupAt = now;
  deleteExpiredClientChallenges(EXPIRED_CHALLENGE_RETAIN_MS).catch((error) => {
    console.error('清理过期 challenge 失败:', error instanceof Error ? error.message : 'Unknown error');
  });
}

export async function issueClientChallenge(
  deviceId: string,
  route: ClientChallengeRoute
): Promise<{ challenge: string; expiresAt: Date }> {
  const challenge = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + CLIENT_CHALLENGE_TTL_SECONDS * 1000);
  await insertClientChallenge({ challengeHash: hashChallenge(challenge), deviceId, route, expiresAt });
  cleanupExpiredChallengesInBackground();
  return { challenge, expiresAt };
}

export type ClientChallengeCheck = ClientChallengeConsumeResult | 'missing' | 'malformed';

export async function consumeClientChallenge(
  challenge: unknown,
  deviceId: string,
  route: ClientChallengeRoute
): Promise<ClientChallengeCheck> {
  if (challenge === undefined || challenge === null || challenge === '') {
    return 'missing';
  }
  if (typeof challenge !== 'string' || !CHALLENGE_PATTERN.test(challenge)) {
    return 'malformed';
  }
  return await consumeClientChallengeRow({ challengeHash: hashChallenge(challenge), deviceId, route });
}

const CHALLENGE_FAILURES: Record<Exclude<ClientChallengeCheck, 'consumed'>, { errorCode: string; message: string }> = {
  missing: { errorCode: 'CHALLENGE_REQUIRED', message: '缺少 challenge，请先调用 /api/client/challenge 获取' },
  malformed: { errorCode: 'CHALLENGE_INVALID', message: 'challenge 格式不正确' },
  invalid: { errorCode: 'CHALLENGE_INVALID', message: 'challenge 无效，请重新获取' },
  expired: { errorCode: 'CHALLENGE_EXPIRED', message: 'challenge 已过期，请重新获取' },
  used: { errorCode: 'CHALLENGE_USED', message: 'challenge 已使用，请重新获取' },
};

export function challengeFailureResponse(check: Exclude<ClientChallengeCheck, 'consumed'>) {
  const failure = CHALLENGE_FAILURES[check];
  return NextResponse.json(
    { success: false, message: failure.message, error_code: failure.errorCode },
    { status: check === 'missing' || check === 'malformed' ? 400 : 401 }
  );
}

/** 签名配置缺失时的统一响应：拒绝请求，不返回未签名结果。 */
export function signingUnavailableResponse(error: unknown) {
  console.error('响应签名配置不可用:', error instanceof SigningConfigError ? error.message : error);
  return NextResponse.json(
    { success: false, message: '服务配置错误', error_code: 'SIGNING_NOT_CONFIGURED' },
    { status: 503 }
  );
}
