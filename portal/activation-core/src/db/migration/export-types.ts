/**
 * 数据迁移导出/导入类型定义（v2：众生之门式码规则对齐）
 *
 * v1 → v2 变更：
 * - activation_codes 新增 max_uses / used_count / bound_player_id / bound_nickname /
 *   revoked_at / revoked_by / last_used_at；status 语义由 unused|used 变为 active|invalidated
 * - 新增 player_sessions 会话表载荷（可选，旧备份无此段）
 * - 导入 v1 载荷时：status 归一为 active，max_uses 一律置 NULL（不限次）
 */

export interface AdminUserExportRecord {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface ActivationCodeExportRecord {
  id: number;
  code: string;
  /** 持久状态：active | invalidated（v1 载荷中为 unused | used） */
  status: "active" | "invalidated";
  /** 派生状态：invalidated | expired | exhausted | active（v1 载荷无此字段） */
  derived_status?: "active" | "invalidated" | "expired" | "exhausted";
  expires_at: string | null;
  used_at: string | null;
  used_by_device_id: string | null;
  validity_days: number | null;
  /** 次数上限；null = 不限次（存量码迁移后固定为 NULL） */
  max_uses: number | null;
  /** 已结算次数 */
  used_count: number;
  /** 首玩家绑定 */
  bound_player_id: string | null;
  bound_nickname: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerSessionExportRecord {
  id: number;
  player_id: string;
  nickname: string | null;
  race: string | null;
  activation_code_id: number | null;
  event_access: boolean;
  status: "active" | "ended" | "kicked" | "expired";
  remaining_uses: number | null;
  /** 会话令牌 SHA-256 摘要（不含明文） */
  session_token_hash: string;
  issued_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  end_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivationCoreExportPayload {
  /** 载荷版本：1 = 改造前；2 = 众生之门式码规则（含会话表） */
  version: 1 | 2;
  exported_at: string;
  admin_users: AdminUserExportRecord[];
  activation_codes: ActivationCodeExportRecord[];
  /** v2 起提供 */
  player_sessions?: PlayerSessionExportRecord[];
}
