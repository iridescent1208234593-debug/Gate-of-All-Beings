/**
 * 服务启动钩子：Next.js 在服务器启动时调用一次 register()（构建阶段不调用）。
 *
 * 凭据不合格时：
 * - production：打印原因后直接退出进程（Next.js 对 register() 抛错只会“prepare 失败”并
 *   继续监听端口、对所有请求返回 500，进程守护无法察觉）；
 * - 其他环境：抛错，交给 Next.js 显示。
 */
import { assertServerCredentials, isProductionEnv } from '@/lib/server-credentials';

export function register() {
  try {
    assertServerCredentials();
  } catch (error) {
    if (process.env.NEXT_RUNTIME === 'nodejs' && isProductionEnv()) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
    throw error;
  }
}
