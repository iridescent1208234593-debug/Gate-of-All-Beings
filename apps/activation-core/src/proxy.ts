import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getAdminSecretValue, getJwtSecretKey } from '@/lib/server-credentials';

// 完整的 JWT 验证函数（包括签名验证）
async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// ===== 管理密钥通道（X-Admin-Key / Authorization: Bearer）=====
// 说明：中间件运行在 Edge 运行时，无法使用 node:crypto，
// 故此处用 TextEncoder + 异或累加实现常量时间比较（不做提前返回）。
const ADMIN_KEY_HEADER = 'x-admin-key';

function readProvidedAdminKey(request: NextRequest): string | null {
  const headerKey = request.headers.get(ADMIN_KEY_HEADER);
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim();
  }

  const authorization = request.headers.get('authorization');
  if (authorization && /^bearer\s+/i.test(authorization)) {
    const bearer = authorization.replace(/^bearer\s+/i, '').trim();
    if (bearer.length > 0 && bearer !== 'undefined' && bearer !== 'null') {
      return bearer;
    }
  }

  return null;
}

function isValidAdminKey(candidate: string | null): boolean {
  const secret = getAdminSecretValue();
  if (!secret || !candidate) return false;

  const encoder = new TextEncoder();
  const candidateBytes = encoder.encode(candidate);
  const secretBytes = encoder.encode(secret);

  // 长度不等直接判定不匹配（避免长度信息被放大）
  if (candidateBytes.length !== secretBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < secretBytes.length; i++) {
    diff |= candidateBytes[i] ^ secretBytes[i];
  }

  return diff === 0;
}

/** 把 JWT 解析出的用户名透传给路由处理器（供审计使用） */
function nextWithAdminUser(request: NextRequest, username: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-admin-username', username);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// 需要保护的路径
const protectedPaths = [
  '/admin',
  '/admin/codes',
  '/admin/generate',
  '/admin/devices',
  '/admin/settings'
];

// 需要保护的 API 路径
const protectedApiPaths = [
  '/api/admin/codes',
  '/api/admin/devices',
  '/api/admin/stats',
  '/api/admin/settings',
  '/api/admin/players',
  '/api/admin/ping'
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否是需要保护的路径
  const isProtectedPath = protectedPaths.some(path =>
    pathname === path || pathname.startsWith(path + '/')
  );

  const isProtectedApiPath = protectedApiPaths.some(path =>
    pathname === path || pathname.startsWith(path + '/')
  );

  // 如果不是保护的路径，直接通过
  if (!isProtectedPath && !isProtectedApiPath) {
    return NextResponse.next();
  }

  // 管理密钥通道：API 路径携带合法 X-Admin-Key 时直接放行（无需 JWT Cookie）
  if (isProtectedApiPath && isValidAdminKey(readProvidedAdminKey(request))) {
    return NextResponse.next();
  }

  // 从 Cookie 中获取 token
  const token = request.cookies.get('token')?.value;

  if (!token) {
    // 如果是 API 路径，返回 401
    if (isProtectedApiPath) {
      return NextResponse.json(
        { success: false, message: '未授权访问' },
        { status: 401 }
      );
    }

    // 如果是页面路径，重定向到登录页
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // 完整的 JWT 验证（包括签名验证）
    const decoded = await verifyJWT(token);

    // 检查 token 是否包含必要信息
    if (!decoded.id || !decoded.username || decoded.role !== 'admin') {
      throw new Error('Invalid token payload');
    }

    // Token 有效，允许访问（透传用户名供路由审计使用）
    return nextWithAdminUser(request, String(decoded.username));

  } catch (error) {
    // 安全日志：不记录敏感信息
    console.error('JWT 验证失败:', error instanceof Error ? error.message : 'Unknown error');

    // 清除无效的 token
    const response = isProtectedApiPath
      ? NextResponse.json(
          { success: false, message: 'Token 无效或已过期' },
          { status: 401 }
        )
      : NextResponse.redirect(new URL('/admin/login', request.url));

    // 清除当前的 token cookie - 使用与设置时相同的安全属性
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 0,
      path: '/'
    });

    // 清除旧的 admin_token cookie（向后兼容）
    response.cookies.set('admin_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 0,
      path: '/'
    });

    return response;
  }
}

// 配置代理匹配的路径
export const config = {
  matcher: [
    // 匹配管理员根路径
    '/admin',
    // 匹配需要保护的管理员路径（排除登录和首次初始化页面）
    '/admin/((?!login|setup).*)',
    // 匹配管理员 API 路径（排除登录和首次初始化 API）
    '/api/admin/((?!login|setup).*)',
  ],
};
