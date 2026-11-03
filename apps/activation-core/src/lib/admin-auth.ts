import { SignJWT } from 'jose';
import { getJwtSecretKey } from './server-credentials';

const ADMIN_SESSION_MAX_AGE = 24 * 60 * 60;

export interface AdminSessionUser {
  id: number;
  username: string;
}

export async function createAdminSessionToken(user: AdminSessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    role: 'admin'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecretKey());
}

export function getAdminSessionCookieOptions(maxAge: number = ADMIN_SESSION_MAX_AGE) {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge,
    path: '/'
  } as const;
}

export function getClearedAdminSessionCookieOptions() {
  return getAdminSessionCookieOptions(0);
}
