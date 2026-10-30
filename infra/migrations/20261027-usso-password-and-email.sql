-- 20261027 · USSO 密码登录与站内邮箱绑定
--
-- 背景
--   1) USSO 账号原先只能用单点登录，没有本站密码。
--   2) USSO 自带邮箱（users.email）与「站内重新绑定的邮箱」（account_emails）需要并存：
--      - 用户没设置新邮箱时，默认用 USSO 自带邮箱作为安全信道；
--      - 用户设置了新邮箱后，以新邮箱为准，且它同样可以作为登录标识。
--
-- 适用库: <storage>/production/data/huiguan/users.db
-- 幂等性: 可重复执行（CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE）
--
-- 用法:
--   sqlite3 /path/to/users.db < 20261027-usso-password-and-email.sql

BEGIN;

-- 1) USSO 账号的登录密码（与 users 表解耦，避免改动既有表结构）
CREATE TABLE IF NOT EXISTS usso_passwords (
    user_id    TEXT PRIMARY KEY,
    pass_hash  TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2) 为尚未建立站内邮箱记录的 USSO 账号补一条默认邮箱
--    （verified_at 直接使用当前时间：来源是身份提供方，视同已验证）
INSERT OR IGNORE INTO account_emails(kind, uid, email, email_norm, verified_at)
SELECT 'usso',
       CAST(u.user_id AS TEXT),
       trim(u.email),
       lower(trim(u.email)),
       datetime('now')
FROM users u
WHERE u.email IS NOT NULL
  AND length(trim(u.email)) > 0
  AND NOT EXISTS (
        SELECT 1 FROM account_emails e
        WHERE e.kind = 'usso' AND e.uid = CAST(u.user_id AS TEXT)
  );

COMMIT;

-- 校验（执行后可手动运行）
-- SELECT count(*) FROM usso_passwords;
-- SELECT e.uid, e.email, u.nickname FROM account_emails e
--   LEFT JOIN users u ON u.user_id = e.uid WHERE e.kind='usso';
