import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/admin-guard';
import { invalidateCodes, invalidateCode } from '@/server/activation';
import { cleanActivationCode } from '@/lib/utils';

/**
 * 作废激活码 API
 * POST /api/admin/codes/invalidate
 *
 * 请求体参数（两种方式二选一）：
 * - ids: number[]  —— 按主键批量作废
 * - code: string   —— 按码值作废
 * - reason: string —— 作废原因（可选，默认 manual）
 *
 * 作废为永久失效（status = invalidated，写入 revoked_at / revoked_by），
 * 同时踢出该码下所有活跃会话。
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireAdminAccess(request);

    if (!access.ok) {
      return NextResponse.json(
        { success: false, message: access.message ?? '未授权访问' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: '请求体格式错误' },
        { status: 400 }
      );
    }

    const ids = Array.isArray(body.ids)
      ? body.ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    const rawCode = typeof body.code === 'string' ? body.code.trim() : '';
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'manual';

    if (ids.length === 0 && !rawCode) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数：ids 或 code' },
        { status: 400 }
      );
    }

    const operator = `${access.username ?? 'unknown'}:${reason}`;

    if (rawCode) {
      const cleanCode = cleanActivationCode(rawCode);
      const result = await invalidateCode(cleanCode, operator);

      if (result.invalidated === 0) {
        return NextResponse.json(
          { success: false, message: '激活码不存在或已作废' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: `激活码已作废，并踢出 ${result.kickedSessions} 个活跃会话`,
          data: {
            invalidated: result.invalidated,
            kicked_sessions: result.kickedSessions,
            code: cleanCode
          }
        },
        { status: 200 }
      );
    }

    const result = await invalidateCodes(ids, operator);

    return NextResponse.json(
      {
        success: true,
        message: `已作废 ${result.invalidated} 个激活码，踢出 ${result.kickedSessions} 个活跃会话`,
        data: {
          invalidated: result.invalidated,
          kicked_sessions: result.kickedSessions,
          requested: ids.length,
          codes: result.codes
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('codes/invalidate API 错误:', error);

    return NextResponse.json(
      { success: false, message: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
