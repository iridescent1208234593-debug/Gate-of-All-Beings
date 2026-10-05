import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/admin-guard';
import { exportActivationCodes } from '@/server/activation';
import { formatDateTimeForAPI } from '@/lib/utils';

/**
 * 激活码导出 API
 * GET /api/admin/codes/export?status=&search=&unbound_only=&format=json
 *
 * 鉴权：X-Admin-Key 或 JWT Cookie
 * 返回：全量（不分页）符合条件的激活码明细，供运营侧导出留档
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminAccess(request);

    if (!access.ok) {
      return NextResponse.json(
        { success: false, message: access.message ?? '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim() || 'all';
    const search = searchParams.get('search')?.trim() || '';
    const unboundOnly = searchParams.get('unbound_only') === 'true';

    const codes = await exportActivationCodes({
      status,
      search: search || undefined,
      unboundOnly
    });

    const exportedAt = new Date();

    return NextResponse.json(
      {
        success: true,
        message: `导出 ${codes.length} 条激活码`,
        data: {
          exported_at: formatDateTimeForAPI(exportedAt),
          operator: access.username ?? 'unknown',
          filters: { status, search: search || null, unbound_only: unboundOnly },
          total: codes.length,
          codes: codes.map((code) => ({
            id: code.id,
            code: code.code,
            status: code.status,
            derived_status: code.derived_status,
            max_uses: code.max_uses,
            used_count: code.used_count,
            remaining_uses: code.remaining_uses,
            bound_player_id: code.bound_player_id,
            bound_nickname: code.bound_nickname,
            used_by_device_id: code.used_by_device_id,
            validity_days: code.validity_days,
            expires_at: formatDateTimeForAPI(code.expires_at),
            used_at: formatDateTimeForAPI(code.used_at),
            last_used_at: formatDateTimeForAPI(code.last_used_at),
            revoked_at: formatDateTimeForAPI(code.revoked_at),
            revoked_by: code.revoked_by,
            created_at: formatDateTimeForAPI(code.created_at),
            updated_at: formatDateTimeForAPI(code.updated_at)
          }))
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('codes/export API 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
