/**
 * 独立进程（= 另一个应用实例）对同一限流键计数，用于验证多实例共享限流状态。
 * 用法：node --import tsx tests/helpers/consume-rate-limit.ts <key> <次数> <上限>
 */
import { prepareTestEnv } from './test-env';

async function main() {
  prepareTestEnv();
  const [key, times, maxRequests] = process.argv.slice(2);
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const { dbPool } = await import('@/db/client');
  const results = [];
  for (let i = 0; i < Number(times); i++) {
    const result = await checkRateLimit(key, { maxRequests: Number(maxRequests), windowMs: 60_000, keyPrefix: 'instance_test' });
    results.push({ count: result.count, limited: result.limited });
  }
  await dbPool.end();
  process.stdout.write(JSON.stringify(results));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
