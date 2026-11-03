/**
 * activation-core 测试环境
 *
 * 数据库测试只连 ACTIVATION_CORE_TEST_DATABASE_URL 指向的一次性库（库名必须含 "test"），
 * 绝不回落到 DATABASE_URL，避免误连真实数据库。未设置时数据库测试显式跳过。
 * 必须在 import 任何 '@/...' 模块之前调用 prepareTestEnv()。
 */
import path from 'node:path';

export const TEST_CLIENT_API_KEY = 'test-client-api-key-0123456789abcdef0123456789';

export function getTestDatabaseUrl(): string | null {
  const url = process.env.ACTIVATION_CORE_TEST_DATABASE_URL;
  if (!url) return null;
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName)) {
    throw new Error(`ACTIVATION_CORE_TEST_DATABASE_URL 的库名必须包含 "test"（当前：${dbName}）`);
  }
  return url;
}

export function prepareTestEnv(overrides: Record<string, string | undefined> = {}): void {
  const databaseUrl = getTestDatabaseUrl();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl ?? 'postgresql://unused@127.0.0.1:1/unused_test',
    CLIENT_API_KEY: TEST_CLIENT_API_KEY,
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

export const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../drizzle/migrations');

export async function migrateTestDatabase(): Promise<void> {
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const { db } = await import('@/db/client');
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
