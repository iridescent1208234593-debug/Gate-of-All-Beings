import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/admin-guard';
import { isAdminKeyConfigured } from '@/lib/admin-key';
import { formatDateTimeForAPI } from '@/lib/utils';

/**
 * 管理通道探活 API
 * GET /api/admin/ping
 *
 * 鉴权：X-Admin-Key 或 JWT Cookie（双通道任一通过即可）
 */
export async function GET(request: NextRequest) {
  const access = await requireAdminAccess(request);

  if (!access.ok) {
    return NextResponse.json(
      { success: false, message: access.message ?? '未授权访问' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'pong',
      data: {
        via: access.via,
        operator: access.username ?? 'unknown',
        admin_key_configured: isAdminKeyConfigured(),
        server_time: formatDateTimeForAPI(new Date()),
        timestamp: Date.now()
      }
    },
    { status: 200 }
  );
}
