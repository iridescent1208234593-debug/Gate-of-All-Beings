import { importPKCS8, SignJWT, KeyLike } from 'jose'

/**
 * 响应签名（ES256 license_token）
 *
 * 缺少或配置错误的签名密钥 / TTL 一律视为服务不可用：调用方必须在产生任何副作用
 * （核销激活码、消费 challenge）之前调用 assertResponseSigningReady()，失败即拒绝请求，
 * 不返回未签名的“已激活”结果。
 */

const DEFAULT_TOKEN_TTL_SECONDS = 120
const MIN_TOKEN_TTL_SECONDS = 10
const MAX_TOKEN_TTL_SECONDS = 600

let cachedPrivateKey: KeyLike | null = null

export class SigningConfigError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'SigningConfigError'
	}
}

function ensureEnv(name: string): string {
	const v = process.env[name]
	if (!v || v.trim().length === 0) {
		throw new SigningConfigError(`Security error: missing required env ${name}`)
	}
	return v
}

async function getPrivateKey(): Promise<KeyLike> {
	if (cachedPrivateKey) return cachedPrivateKey
	const pem = ensureEnv('RESPONSE_SIGN_PRIVATE_KEY_PEM').replace(/\\n/g, '\n')
	try {
		cachedPrivateKey = await importPKCS8(pem, 'ES256')
	} catch {
		throw new SigningConfigError('Security error: RESPONSE_SIGN_PRIVATE_KEY_PEM is not a valid ES256 PKCS#8 key')
	}
	return cachedPrivateKey
}

/** license_token 有效期（秒）：默认 120，只接受 10–600 的整数，其他值视为配置错误。 */
export function getTokenTtlSeconds(): number {
	const raw = process.env.RESPONSE_SIGN_TOKEN_TTL_SEC
	if (raw === undefined || raw.trim() === '') return DEFAULT_TOKEN_TTL_SECONDS
	const ttl = Number(raw)
	if (!Number.isInteger(ttl) || ttl < MIN_TOKEN_TTL_SECONDS || ttl > MAX_TOKEN_TTL_SECONDS) {
		throw new SigningConfigError(
			`Security error: RESPONSE_SIGN_TOKEN_TTL_SEC must be an integer between ${MIN_TOKEN_TTL_SECONDS} and ${MAX_TOKEN_TTL_SECONDS}`
		)
	}
	return ttl
}

/** 签名配置可用则返回，否则抛 SigningConfigError。 */
export async function assertResponseSigningReady(): Promise<void> {
	await getPrivateKey()
	getTokenTtlSeconds()
}

/** 测试用：清除已缓存的私钥，使下一次调用重新读取环境变量。 */
export function resetSigningKeyCache(): void {
	cachedPrivateKey = null
}

export function getKeyInfo(): { alg: string; kid?: string } {
	const kid = process.env.RESPONSE_SIGN_KEY_ID
	return { alg: 'ES256', ...(kid ? { kid } : {}) }
}

export async function createLicenseToken(claims: Record<string, unknown>): Promise<string> {
	const key = await getPrivateKey()
	const ttl = getTokenTtlSeconds()
	const kid = process.env.RESPONSE_SIGN_KEY_ID
	const nowSec = Math.floor(Date.now() / 1000)

	return await new SignJWT(claims)
		.setProtectedHeader({ alg: 'ES256', ...(kid ? { kid } : {}) })
		.setIssuedAt(nowSec)
		.setExpirationTime(nowSec + ttl)
		.sign(key)
}
