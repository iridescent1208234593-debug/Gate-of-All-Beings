import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  requireAdminAccess,
  verifyAdminSessionToken,
  type AdminAccessResult
} from '@/lib/admin-guard';

/**
 * 入口层防护（第一道）：拦截未登录的后台页面与管理 API 请求。
 *
 * 管理 API 的安全边界在路由内：每个 /api/admin/* 处理器都用 withAdminAccess 包装，
 * 即使请求绕过这里也会执行完整鉴权。这里与路由共用 admin-guard 的同一套规则
 * （Next.js 16 的 proxy 运行在 Node.js 运行时，可以直接复用）。
 */

// 不需要登录即可访问的管理入口（首次初始化与登录本身）
const PUBLIC_ADMIN_PAGES = ['/admin/login', '/admin/setup'];
const PUBLIC_ADMIN_APIS = ['/api/admin/login', '/api/admin/setup'];

// 旧版本曾由 proxy 注入的身份头；路由不再读取，入口处仍一律剥离，防止客户端伪造
const LEGACY_IDENTITY_HEADERS = ['x-admin-username', 'x-admin-id'];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((path) => pathname === path || pathname.startsWith(path + '/'));
}

function isProtectedPage(pathname: string): boolean {
  return matches(pathname, ['/admin']) && !matches(pathname, PUBLIC_ADMIN_PAGES);
}

function isProtectedApi(pathname: string): boolean {
  return matches(pathname, ['/api/admin']) && !matches(pathname, PUBLIC_ADMIN_APIS);
}

function nextWithoutIdentityHeaders(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  for (const header of LEGACY_IDENTITY_HEADERS) {
    requestHeaders.delete(header);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function clearSessionCookies(response: NextResponse) {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 0,
    path: '/'
  } as const;

  response.cookies.set(ADMIN_SESSION_COOKIE, '', options);
  // 清除旧的 admin_token cookie（向后兼容）
  response.cookies.set('admin_token', '', options);
  return response;
}

function rejectApi(access: AdminAccessResult, hadSessionCookie: boolean) {
  const response = NextResponse.json(
    { success: false, message: access.message ?? '未授权访问' },
    { status: 401 }
  );
  return hadSessionCookie && access.via === 'none' ? clearSessionCookies(response) : response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hadSessionCookie = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (isProtectedApi(pathname)) {
    const access = await requireAdminAccess(request);
    return access.ok ? nextWithoutIdentityHeaders(request) : rejectApi(access, hadSessionCookie);
  }

  if (isProtectedPage(pathname)) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

    if (!token) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const access = await verifyAdminSessionToken(token);
    if (!access.ok) {
      // 安全日志：不记录敏感信息
      console.error('管理员会话验证失败:', access.message);
      return clearSessionCookies(NextResponse.redirect(new URL('/admin/login', request.url)));
    }

    return nextWithoutIdentityHeaders(request);
  }

  return nextWithoutIdentityHeaders(request);
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
