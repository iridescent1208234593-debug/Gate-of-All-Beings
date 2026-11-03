/**
 * 服务端凭据校验（唯一规则来源）
 *
 * 所有读取 JWT_SECRET / CLIENT_API_KEY / ADMIN_SECRET / EVENT_ACCESS_CODE / DATABASE_URL
 * 的入口都通过本模块校验，避免多个入口各写一份规则后发生漂移。
 *
 * 规则：
 * - production（NODE_ENV=production）：
 *   - JWT_SECRET、CLIENT_API_KEY、DATABASE_URL 必须配置；
 *   - ADMIN_SECRET、EVENT_ACCESS_CODE 可选（未配置时对应通道关闭），但一旦配置也必须合格；
 *   - 任何一项使用仓库示例/占位值，或强度不足（长度、字符多样性），拒绝启动。
 * - 其他环境：JWT_SECRET 必须配置且不能是占位值（与原有行为一致）；其余问题只告警，
 *   方便本地开发。
 *
 * 本模块不依赖 node: 内置模块，可在 proxy 与路由处理器中共同使用。
 */

export type CredentialName =
  | 'JWT_SECRET'
  | 'CLIENT_API_KEY'
  | 'ADMIN_SECRET'
  | 'EVENT_ACCESS_CODE'
  | 'DATABASE_URL';

export type CredentialProblemKind = 'missing' | 'placeholder' | 'weak';

export interface CredentialProblem {
  name: CredentialName;
  kind: CredentialProblemKind;
  message: string;
}

type Env = Record<string, string | undefined>;

interface SecretRule {
  name: Exclude<CredentialName, 'DATABASE_URL'>;
  requiredInProduction: boolean;
  /** 任何环境都必须配置（JWT_SECRET：缺失时无法签发/验证管理员会话） */
  requiredAlways?: boolean;
  minLength: number;
  minDistinctChars: number;
}

/** 生成方法：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" */
const SECRET_RULES: readonly SecretRule[] = [
  { name: 'JWT_SECRET', requiredInProduction: true, requiredAlways: true, minLength: 32, minDistinctChars: 8 },
  { name: 'CLIENT_API_KEY', requiredInProduction: true, minLength: 32, minDistinctChars: 8 },
  { name: 'ADMIN_SECRET', requiredInProduction: false, minLength: 32, minDistinctChars: 8 },
  // 事件访问码由玩家在现场输入，允许比服务端密钥短，但仍需足够难猜
  { name: 'EVENT_ACCESS_CODE', requiredInProduction: false, minLength: 12, minDistinctChars: 6 },
];

/** 仓库示例与历史默认值（精确匹配，忽略大小写与首尾空白） */
const KNOWN_PLACEHOLDER_VALUES: readonly string[] = [
  'your-secret-key',
  'your-super-secret-jwt-key-at-least-32-characters-long',
  'your-client-api-key-at-least-32-characters-long',
  'replace-with-database-password',
  'password',
  'secret',
  'changeme',
  'change-me',
  'admin',
  'test',
];

/** 示例值的常见写法（子串匹配） */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^your[-_]/i,
  /replace[-_ ]?(with|me)/i,
  /change[-_ ]?me/i,
  /placeholder/i,
  /at[-_]least[-_]\d+[-_]char/i,
  /^<.*>$/,
  /^x{6,}$/i,
  /^\$\{.*\}$/,
];

export function isProductionEnv(env: Env = process.env): boolean {
  return env.NODE_ENV === 'production';
}

/** 判断取值是否为示例/占位值 */
export function isPlaceholderCredential(value: string): boolean {
  const normalized = value.trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (normalized.length === 0) return true;
  if (KNOWN_PLACEHOLDER_VALUES.includes(normalized)) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function checkSecret(rule: SecretRule, env: Env, production: boolean): CredentialProblem | null {
  const raw = env[rule.name];
  const value = raw?.trim() ?? '';

  if (value.length === 0) {
    if (rule.requiredAlways || (production && rule.requiredInProduction)) {
      return { name: rule.name, kind: 'missing', message: `${rule.name} 未配置` };
    }
    return null;
  }

  if (isPlaceholderCredential(value)) {
    return {
      name: rule.name,
      kind: 'placeholder',
      message: `${rule.name} 使用了示例/占位值，请生成新的随机值`,
    };
  }

  if (value.length < rule.minLength) {
    return {
      name: rule.name,
      kind: 'weak',
      message: `${rule.name} 长度不足（至少 ${rule.minLength} 个字符）`,
    };
  }

  if (new Set(value).size < rule.minDistinctChars) {
    return {
      name: rule.name,
      kind: 'weak',
      message: `${rule.name} 字符过于单一（至少 ${rule.minDistinctChars} 种不同字符）`,
    };
  }

  return null;
}

function checkDatabaseUrl(env: Env, production: boolean): CredentialProblem | null {
  const value = env.DATABASE_URL?.trim() ?? '';

  if (value.length === 0) {
    return production
      ? { name: 'DATABASE_URL', kind: 'missing', message: 'DATABASE_URL 未配置' }
      : null;
  }

  // 只取 scheme://user:password@ 中的密码；不用 URL 解析，示例里的 host:port 占位也能识别
  const match = value.match(/^[a-z][a-z0-9+.-]*:\/\/[^:@/]*:([^@/]*)@/i);
  let password = match ? match[1] : '';
  try {
    password = decodeURIComponent(password);
  } catch {
    // 非法百分号编码时按原文判断
  }

  if (password.length > 0 && isPlaceholderCredential(password)) {
    return {
      name: 'DATABASE_URL',
      kind: 'placeholder',
      message: 'DATABASE_URL 中的数据库密码是示例/占位值',
    };
  }

  return null;
}

/** 列出全部凭据问题（不抛错） */
export function findCredentialProblems(env: Env = process.env): CredentialProblem[] {
  const production = isProductionEnv(env);
  const problems: CredentialProblem[] = [];

  for (const rule of SECRET_RULES) {
    const problem = checkSecret(rule, env, production);
    if (problem) problems.push(problem);
  }

  const databaseProblem = checkDatabaseUrl(env, production);
  if (databaseProblem) problems.push(databaseProblem);

  return problems;
}

/** 非 production 也必须拦截的问题：JWT_SECRET 缺失或为占位值（原有行为） */
function isFatalOutsideProduction(problem: CredentialProblem): boolean {
  return problem.name === 'JWT_SECRET' && problem.kind !== 'weak';
}

function formatProblems(problems: CredentialProblem[]): string {
  return problems.map((problem) => `  - ${problem.message}`).join('\n');
}

export class CredentialConfigError extends Error {
  readonly problems: CredentialProblem[];

  constructor(problems: CredentialProblem[]) {
    super(
      `🔒 安全错误: 服务端凭据配置不合格，拒绝启动：\n${formatProblems(problems)}\n` +
        '请用 `pnpm run generate-keys` 生成新的随机凭据，不要使用 .env.example 或 README 中的示例值。'
    );
    this.name = 'CredentialConfigError';
    this.problems = problems;
  }
}

/**
 * 启动期整体校验：production 下任一问题即抛错；其他环境只对 JWT_SECRET 缺失/占位值抛错，
 * 其余问题打印告警。
 */
export function assertServerCredentials(env: Env = process.env): void {
  const problems = findCredentialProblems(env);
  if (problems.length === 0) return;

  const fatal = isProductionEnv(env) ? problems : problems.filter(isFatalOutsideProduction);
  if (fatal.length > 0) {
    throw new CredentialConfigError(fatal);
  }

  console.warn(`⚠️ 凭据配置告警（非 production 环境不阻止启动）：\n${formatProblems(problems)}`);
}

/** 单项校验：按与 assertServerCredentials 相同的规则判断该项是否可用 */
function assertCredential(name: CredentialName, env: Env): void {
  const problems = findCredentialProblems(env).filter((problem) => problem.name === name);
  const fatal = isProductionEnv(env) ? problems : problems.filter(isFatalOutsideProduction);
  if (fatal.length > 0) {
    throw new CredentialConfigError(fatal);
  }
}

/** 读取已校验的 JWT_SECRET（供签发与验证共用；原样返回，不改变既有 token 的签名密钥） */
export function getJwtSecret(env: Env = process.env): string {
  assertCredential('JWT_SECRET', env);
  return env.JWT_SECRET as string;
}

export function getJwtSecretKey(env: Env = process.env): Uint8Array {
  return new TextEncoder().encode(getJwtSecret(env));
}

/** 读取 CLIENT_API_KEY；未配置返回 null，配置不合格（production）抛错 */
export function getClientApiKey(env: Env = process.env): string | null {
  assertCredential('CLIENT_API_KEY', env);
  const value = env.CLIENT_API_KEY?.trim();
  return value ? value : null;
}

/** 读取 ADMIN_SECRET；未配置返回 null（管理密钥通道关闭），配置不合格（production）抛错 */
export function getAdminSecretValue(env: Env = process.env): string | null {
  assertCredential('ADMIN_SECRET', env);
  const value = env.ADMIN_SECRET?.trim();
  return value ? value : null;
}

/** 读取 EVENT_ACCESS_CODE；未配置返回 null（事件码通道关闭），配置不合格（production）抛错 */
export function getEventAccessCodeValue(env: Env = process.env): string | null {
  assertCredential('EVENT_ACCESS_CODE', env);
  const value = env.EVENT_ACCESS_CODE?.trim();
  return value ? value : null;
}
