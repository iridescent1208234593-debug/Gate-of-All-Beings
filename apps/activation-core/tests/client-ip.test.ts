/**
 * #43 M13：客户端不可通过自报转发头改变限流身份
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareTestEnv } from './helpers/test-env';

prepareTestEnv({ IRIDESCENTLY_CLIENT_IP_HEADER: undefined });

function requestWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/client/verify', { method: 'POST', headers });
}

const SPOOFED = {
  'x-forwarded-for': '198.51.100.7',
  'x-real-ip': '198.51.100.8',
  'cf-connecting-ip': '198.51.100.9',
  'x-vercel-forwarded-for': '198.51.100.10',
};

async function loadRateLimit() {
  return await import('@/lib/rate-limit');
}

test('未声明可信入口头时，任何自报转发头都不改变身份', async () => {
  delete process.env.IRIDESCENTLY_CLIENT_IP_HEADER;
  const { getClientIP, UNKNOWN_CLIENT_IP } = await loadRateLimit();
  assert.equal(getClientIP(requestWith(SPOOFED)), UNKNOWN_CLIENT_IP);
  assert.equal(getClientIP(requestWith({ 'x-forwarded-for': '203.0.113.1' })), UNKNOWN_CLIENT_IP);
  assert.equal(getClientIP(requestWith({})), UNKNOWN_CLIENT_IP);
});

test('声明 cf-connecting-ip 后只读该头，忽略其他转发头', async () => {
  process.env.IRIDESCENTLY_CLIENT_IP_HEADER = 'CF-Connecting-IP';
  const { getClientIP } = await loadRateLimit();
  assert.equal(getClientIP(requestWith({ ...SPOOFED, 'cf-connecting-ip': '203.0.113.5' })), '203.0.113.5');
  assert.equal(getClientIP(requestWith({ 'x-forwarded-for': '203.0.113.6' })), 'unknown');
});

test('声明 x-forwarded-for 时只取最右一项（紧邻可信代理写入），客户端前置项无效', async () => {
  process.env.IRIDESCENTLY_CLIENT_IP_HEADER = 'x-forwarded-for';
  const { getClientIP } = await loadRateLimit();
  assert.equal(getClientIP(requestWith({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' })), '203.0.113.9');
  assert.equal(getClientIP(requestWith({ 'x-forwarded-for': '9.9.9.9,203.0.113.10' })), '203.0.113.10');
});

test('入口头内容不是合法 IP 时归入共享身份', async () => {
  process.env.IRIDESCENTLY_CLIENT_IP_HEADER = 'x-real-ip';
  const { getClientIP } = await loadRateLimit();
  assert.equal(getClientIP(requestWith({ 'x-real-ip': 'not-an-ip' })), 'unknown');
  assert.equal(getClientIP(requestWith({ 'x-real-ip': `${'a'.repeat(300)}` })), 'unknown');
  assert.equal(getClientIP(requestWith({ 'x-real-ip': '::ffff:203.0.113.11' })), '203.0.113.11');
  assert.equal(getClientIP(requestWith({ 'x-real-ip': '[2001:DB8::1]' })), '2001:db8::1');
});

test('非白名单的入口头配置直接报错（fail closed）', async () => {
  process.env.IRIDESCENTLY_CLIENT_IP_HEADER = 'x-client-ip';
  const { getClientIP } = await loadRateLimit();
  assert.throws(() => getClientIP(requestWith({ 'x-client-ip': '203.0.113.12' })), /IRIDESCENTLY_CLIENT_IP_HEADER/);
});

test('IPv6 按 /64 计限流身份，同段内轮换地址不得新额度', async () => {
  const { toRateLimitIpKey } = await loadRateLimit();
  assert.equal(toRateLimitIpKey('203.0.113.1'), '203.0.113.1');
  assert.equal(toRateLimitIpKey('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.equal(toRateLimitIpKey('2001:db8:1:2:ffff:ffff:ffff:ffff'), '2001:db8:1:2::/64');
  assert.equal(toRateLimitIpKey('2001:0db8:0001:0002::'), '2001:db8:1:2::/64');
  assert.equal(toRateLimitIpKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(toRateLimitIpKey('::1'), '0:0:0:0::/64');
  assert.equal(toRateLimitIpKey('64:ff9b::203.0.113.1'), '64:ff9b:0:0::/64');
  assert.notEqual(toRateLimitIpKey('2001:db8:1:2::1'), toRateLimitIpKey('2001:db8:1:3::1'));
});
