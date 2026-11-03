import { NextRequest, NextResponse } from 'next/server';
import { withAdminAccess } from '@/lib/admin-guard';
import { getAdminById, updateAdminPassword } from '@/server/admin';
import bcrypt from 'bcryptjs';
import { formatDateTimeForAPI } from '@/lib/utils';

/**
 * 修改管理员密码 API
 * POST /api/admin/settings/password
 */
export const POST = withAdminAccess(async (request: NextRequest, _context, access) => {
  try {
    // 管理员 ID 来自已验证签名、有效期与角色的会话 token（withAdminAccess），
    // 管理密钥通道没有账号身份，已被 requireSession 拒绝
    const adminId = access.adminId as number;

    // 解析请求体
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 验证请求参数
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { 
          success: false, 
          message: '缺少必要参数：currentPassword 和 newPassword' 
        },
        { status: 400 }
      );
    }

    // 验证新密码强度
    if (newPassword.length < 6) {
      return NextResponse.json(
        { 
          success: false, 
          message: '新密码长度至少为6个字符' 
        },
        { status: 400 }
      );
    }

    // 获取当前管理员信息
    const admin = await getAdminById(adminId);

    if (!admin) {
      return NextResponse.json(
        { success: false, message: '管理员账户不存在' },
        { status: 404 }
      );
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, message: '当前密码不正确' },
        { status: 400 }
      );
    }

    // 生成新密码哈希
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 更新密码
    const updated = await updateAdminPassword(adminId, newPasswordHash);

    if (!updated) {
      return NextResponse.json(
        { success: false, message: '密码更新失败' },
        { status: 500 }
      );
    }

    // 记录操作日志（可选）
    console.log(`管理员 ${admin.username} 修改了密码`);

    return NextResponse.json(
      {
        success: true,
        message: '密码修改成功',
        data: {
          username: admin.username,
          updated_at: formatDateTimeForAPI(new Date())
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('修改密码API错误:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '服务器内部错误，请稍后重试'
      },
      { status: 500 }
    );
  }
}, { requireSession: true });
