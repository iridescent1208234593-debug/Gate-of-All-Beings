/**
 * 频率限制工具
 *
 * - 计数存于数据库表 rate_limit_buckets（固定窗口），多实例 / Serverless 共享同一份状态
 * - 客户端 IP 只从部署方明确声明的可信入口头读取（IRIDESCENTLY_CLIENT_IP_HEADER），
 *   客户端自报的 X-Forwarded-For / X-Real-IP / CF-Connecting-IP 默认一律不信
 * - 设备 / 玩家标识由客户端任意生成，只作附加限额；IP 限额总是先于它们检查
 */

import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { deleteExpiredRateLimitBuckets, incrementRateLimitBucket } from '@/db/repositories/rate-limit-repository';

/**
 * 频率限制配置
 */
export interface RateLimitConfig {
  /** 时间窗口内允许的最大请求数 */
  maxRequests: number;
  /** 时间窗口大小（毫秒） */
  windowMs: number;
  /** 限制键前缀 */
  keyPrefix?: string;
}

/**
 * 频率限制结果
 */
export interface RateLimitResult {
  /** 是否被限制 */
  limited: boolean;
  /** 当前请求数 */
  count: number;
  /** 剩余请求数 */
  remaining: number;
  /** 重置时间戳 */
  resetTime: number;
  /** 距离重置还有多少毫秒 */
  resetTimeMs: number;
}

const EXPIRED_BUCKET_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastExpiredBucketCleanupAt = 0;

function cleanupExpiredBucketsInBackground() {
  const now = Date.now();
  if (now - lastExpiredBucketCleanupAt < EXPIRED_BUCKET_CLEANUP_INTERVAL_MS) {
    return;
  }
  lastExpiredBucketCleanupAt = now;
  deleteExpiredRateLimitBuckets().catch((error) => {
    console.error('清理过期限流记录失败:', error instanceof Error ? error.message : 'Unknown error');
  });
}

function hashIdentity(identity: string): string {
  return createHash('sha256').update(identity, 'utf8').digest('hex');
}

/**
 * 检查并计入一次频率限制（数据库共享计数）
 * @param key 限制键（如 toRateLimitIpKey(IP)、设备 ID、'global'）
 * @param config 频率限制配置
 * @returns 频率限制结果；数据库不可用时抛错，由调用方按 500 处理（不放行）
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const bucketKey = `${config.keyPrefix ?? 'default'}:${hashIdentity(key)}`;
  const state = await incrementRateLimitBucket(bucketKey, config.windowMs);
  cleanupExpiredBucketsInBackground();

  const resetTime = state.expires_at.getTime();
  return {
    limited: state.request_count > config.maxRequests,
    count: state.request_count,
    remaining: Math.max(0, config.maxRequests - state.request_count),
    resetTime,
    resetTimeMs: Math.max(0, resetTime - Date.now())
  };
}

// ===== 可信客户端 IP =====

/** 未声明可信入口头或入口头缺失 / 非法时使用的共享身份 */
export const UNKNOWN_CLIENT_IP = 'unknown';

export const CLIENT_IP_HEADER_ENV = 'IRIDESCENTLY_CLIENT_IP_HEADER';

/**
 * 允许声明的可信入口头。每一种都要求入口代理覆盖（而非透传）该头：
 * - cf-connecting-ip：Cloudflare / Cloudflare Tunnel
 * - x-real-ip：nginx 等反代以 `proxy_set_header X-Real-IP $remote_addr` 覆盖
 * - x-vercel-forwarded-for：Vercel 平台
 * - x-forwarded-for：仅取最右一项，即紧邻本服务的那一层可信代理追加的对端地址
 */
const TRUSTED_CLIENT_IP_HEADERS = new Set([
  'cf-connecting-ip',
  'x-real-ip',
  'x-vercel-forwarded-for',
  'x-forwarded-for'
]);

let warnedMissingClientIpHeader = false;

function getConfiguredClientIpHeader(): string | null {
  const raw = process.env[CLIENT_IP_HEADER_ENV]?.trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (!TRUSTED_CLIENT_IP_HEADERS.has(raw)) {
    throw new Error(
      `Security error: ${CLIENT_IP_HEADER_ENV} must be one of ${[...TRUSTED_CLIENT_IP_HEADERS].join(', ')}`
    );
  }
  return raw;
}

function normalizeIpLiteral(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim();
  if (candidate.startsWith('[') && candidate.includes(']')) {
    candidate = candidate.slice(1, candidate.indexOf(']'));
  }
  const zoneIndex = candidate.indexOf('%');
  if (zoneIndex >= 0) {
    candidate = candidate.slice(0, zoneIndex);
  }
  const version = isIP(candidate);
  if (version === 4) return candidate;
  if (version === 6) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(candidate);
    if (mapped && isIP(mapped[1]) === 4) return mapped[1];
    return candidate.toLowerCase();
  }
  return null;
}

/**
 * 获取可信客户端 IP。
 *
 * 只读取 IRIDESCENTLY_CLIENT_IP_HEADER 声明的那一个入口头；未声明时不信任任何转发头，
 * 返回共享身份 'unknown'（所有请求共用一个 IP 限额，客户端无法靠伪造头部拿到新额度）。
 * Next.js 路由处理器拿不到 TCP 对端地址，且 `next start` 会原样保留客户端自带的
 * X-Forwarded-For，因此独立部署也不能退回读取转发头。
 *
 * @param request 请求对象
 * @returns 规范化后的 IP，或 'unknown'
 */
export function getClientIP(request: Request): string {
  const header = getConfiguredClientIpHeader();
  if (!header) {
    if (!warnedMissingClientIpHeader && process.env.NODE_ENV === 'production') {
      warnedMissingClientIpHeader = true;
      console.warn(`⚠️ 未配置 ${CLIENT_IP_HEADER_ENV}：不信任任何转发头，所有客户端共用同一 IP 限额`);
    }
    return UNKNOWN_CLIENT_IP;
  }

  const value = request.headers.get(header);
  if (!value) {
    return UNKNOWN_CLIENT_IP;
  }

  // 只有 X-Forwarded-For 是逐跳追加的列表：最右一项由紧邻的可信代理写入，左侧各项都可能是客户端自报。
  const entry = header === 'x-forwarded-for' ? value.split(',').pop() : value;
  return normalizeIpLiteral(entry) ?? UNKNOWN_CLIENT_IP;
}

function expandIpv6(ip: string): string[] | null {
  let address = ip;
  // 末尾内嵌的点分 IPv4（如 64:ff9b::1.2.3.4）先换成两个十六进制段
  const lastColon = address.lastIndexOf(':');
  const lastPart = address.slice(lastColon + 1);
  if (lastPart.includes('.')) {
    const octets = lastPart.split('.').map((part) => Number(part));
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    address = `${address.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }
  const missing = 8 - head.length - rest.length;
  if (missing < 1) return null;
  return [...head, ...new Array<string>(missing).fill('0'), ...rest];
}

/**
 * 把客户端 IP 换成限流身份：IPv4 按单地址计；IPv6 按 /64 前缀计
 * （一个用户通常拥有整段 /64，逐地址计数可以无限轮换）。
 */
export function toRateLimitIpKey(ip: string): string {
  if (isIP(ip) !== 6) {
    return ip;
  }
  const hextets = expandIpv6(ip);
  if (!hextets) {
    return ip;
  }
  return `${hextets.slice(0, 4).map((part) => parseInt(part || '0', 16).toString(16)).join(':')}::/64`;
}

/**
 * 预定义的频率限制配置
 */
export const RATE_LIMIT_CONFIGS = {
  // 激活 API 的 IP 限制
  ACTIVATE_IP: {
    maxRequests: process.env.NODE_ENV === 'development' ? 3 : 10, // 开发环境 3 次便于测试
    windowMs: process.env.NODE_ENV === 'development' ? 30 * 1000 : 60 * 1000, // 开发环境 30 秒
    keyPrefix: 'activate_ip'
  } as RateLimitConfig,

  // 激活 API 的设备 ID 限制
  ACTIVATE_DEVICE: {
    maxRequests: process.env.NODE_ENV === 'development' ? 2 : 5, // 开发环境 2 次便于测试
    windowMs: process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 60 * 1000, // 开发环境 1 分钟
    keyPrefix: 'activate_device'
  } as RateLimitConfig,

  // 激活 API 的全局限制：每分钟最多 50 次请求
  ACTIVATE_GLOBAL: {
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 分钟
    keyPrefix: 'activate_global'
  } as RateLimitConfig,

  // 验证 API 的 IP 限制
  VERIFY_IP: {
    maxRequests: process.env.NODE_ENV === 'development' ? 10 : 30, // 开发环境 10 次，生产环境 30 次
    windowMs: process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 1000, // 1 分钟
    keyPrefix: 'verify_ip'
  } as RateLimitConfig,

  // 验证 API 的设备 ID 限制
  VERIFY_DEVICE: {
    maxRequests: process.env.NODE_ENV === 'development' ? 5 : 20, // 开发环境 5 次，生产环境 20 次
    windowMs: process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 1000, // 1 分钟
    keyPrefix: 'verify_device'
  } as RateLimitConfig,

  // 验证 API 的全局限制：每分钟最多 100 次请求
  VERIFY_GLOBAL: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 分钟
    keyPrefix: 'verify_global'
  } as RateLimitConfig,

  // challenge API：每次 verify / activate 前各取一次，额度不低于两者之和
  CHALLENGE_IP: {
    maxRequests: process.env.NODE_ENV === 'development' ? 20 : 60,
    windowMs: 60 * 1000,
    keyPrefix: 'challenge_ip'
  } as RateLimitConfig,

  CHALLENGE_DEVICE: {
    maxRequests: process.env.NODE_ENV === 'development' ? 10 : 40,
    windowMs: 60 * 1000,
    keyPrefix: 'challenge_device'
  } as RateLimitConfig,

  CHALLENGE_GLOBAL: {
    maxRequests: 200,
    windowMs: 60 * 1000,
    keyPrefix: 'challenge_global'
  } as RateLimitConfig
};
