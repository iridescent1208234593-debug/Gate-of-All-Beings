#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const processModule = require("node:process");
const { Pool } = require("pg");

if (fs.existsSync(".env.local")) {
  processModule.loadEnvFile(".env.local");
} else if (fs.existsSync(".env")) {
  processModule.loadEnvFile(".env");
}

if (!process.env.DATABASE_URL) {
  console.error("缺少 DATABASE_URL，无法执行导入");
  process.exit(1);
}

function getInputPath() {
  const argPath = process.argv[2];
  if (!argPath) {
    console.error("请提供导入文件路径，例如: pnpm run db:import -- exports/activation-core-export.json");
    process.exit(1);
  }

  const inputPath = path.resolve(argPath);
  if (!fs.existsSync(inputPath)) {
    console.error(`导入文件不存在: ${inputPath}`);
    process.exit(1);
  }

  return inputPath;
}

/**
 * 归一化激活码行（v1 → v2 兼容）
 * - status：unused | used → active（v2 持久态仅 active | invalidated）
 * - max_uses：v1 载荷缺列，一律置 NULL（不限次），避免存量已用码被判 exhausted
 * - used_count：v1 已绑定设备的码按 1 计，其余按 0
 */
function normalizeCodeRow(row) {
  const boundDevice = row.used_by_device_id ?? null;
  return {
    id: row.id,
    code: row.code,
    status: row.status === "invalidated" ? "invalidated" : "active",
    expires_at: row.expires_at ?? null,
    used_at: row.used_at ?? null,
    used_by_device_id: boundDevice,
    validity_days: row.validity_days ?? null,
    max_uses: row.max_uses ?? null,
    used_count: row.used_count ?? (boundDevice ? 1 : 0),
    bound_player_id: row.bound_player_id ?? null,
    bound_nickname: row.bound_nickname ?? null,
    revoked_at: row.revoked_at ?? null,
    revoked_by: row.revoked_by ?? null,
    last_used_at: row.last_used_at ?? row.used_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parsePayload(inputPath) {
  const raw = fs.readFileSync(inputPath, "utf8");
  const payload = JSON.parse(raw);

  if (payload.version !== 1 && payload.version !== 2) {
    throw new Error(`不支持的数据版本: ${payload.version}`);
  }

  if (!Array.isArray(payload.admin_users) || !Array.isArray(payload.activation_codes)) {
    throw new Error("导入文件结构无效，缺少关键表数据");
  }

  payload.activation_codes = payload.activation_codes.map(normalizeCodeRow);
  payload.player_sessions = Array.isArray(payload.player_sessions) ? payload.player_sessions : [];

  return payload;
}

async function resetSequence(client, tableName, idColumn = "id") {
  await client.query(
    `
      SELECT setval(
        pg_get_serial_sequence($1, $2),
        COALESCE((SELECT MAX(${idColumn}) FROM ${tableName}), 1),
        (SELECT COUNT(*) > 0 FROM ${tableName})
      )
    `,
    [tableName, idColumn]
  );
}

async function main() {
  const inputPath = getInputPath();
  const payload = parsePayload(inputPath);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  });

  const client = await pool.connect();

  try {
    console.log("开始导入关键表数据...");
    console.log(`输入文件: ${inputPath}`);

    await client.query("BEGIN");

    for (const row of payload.admin_users) {
      await client.query(
        `
          INSERT INTO admin_users (id, username, password_hash, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE
          SET username = EXCLUDED.username,
              password_hash = EXCLUDED.password_hash,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
        `,
        [row.id, row.username, row.password_hash, row.created_at, row.updated_at]
      );
    }

    for (const row of payload.activation_codes) {
      await client.query(
        `
          INSERT INTO activation_codes (
            id,
            code,
            status,
            expires_at,
            used_at,
            used_by_device_id,
            validity_days,
            max_uses,
            used_count,
            bound_player_id,
            bound_nickname,
            revoked_at,
            revoked_by,
            last_used_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE
          SET code = EXCLUDED.code,
              status = EXCLUDED.status,
              expires_at = EXCLUDED.expires_at,
              used_at = EXCLUDED.used_at,
              used_by_device_id = EXCLUDED.used_by_device_id,
              validity_days = EXCLUDED.validity_days,
              max_uses = EXCLUDED.max_uses,
              used_count = EXCLUDED.used_count,
              bound_player_id = EXCLUDED.bound_player_id,
              bound_nickname = EXCLUDED.bound_nickname,
              revoked_at = EXCLUDED.revoked_at,
              revoked_by = EXCLUDED.revoked_by,
              last_used_at = EXCLUDED.last_used_at,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
        `,
        [
          row.id,
          row.code,
          row.status,
          row.expires_at,
          row.used_at,
          row.used_by_device_id,
          row.validity_days,
          row.max_uses,
          row.used_count,
          row.bound_player_id,
          row.bound_nickname,
          row.revoked_at,
          row.revoked_by,
          row.last_used_at,
          row.created_at,
          row.updated_at,
        ]
      );
    }

    for (const row of payload.player_sessions) {
      await client.query(
        `
          INSERT INTO player_sessions (
            id,
            player_id,
            nickname,
            race,
            activation_code_id,
            event_access,
            status,
            remaining_uses,
            session_token_hash,
            issued_at,
            last_heartbeat_at,
            ended_at,
            end_reason,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE
          SET player_id = EXCLUDED.player_id,
              nickname = EXCLUDED.nickname,
              race = EXCLUDED.race,
              activation_code_id = EXCLUDED.activation_code_id,
              event_access = EXCLUDED.event_access,
              status = EXCLUDED.status,
              remaining_uses = EXCLUDED.remaining_uses,
              session_token_hash = EXCLUDED.session_token_hash,
              issued_at = EXCLUDED.issued_at,
              last_heartbeat_at = EXCLUDED.last_heartbeat_at,
              ended_at = EXCLUDED.ended_at,
              end_reason = EXCLUDED.end_reason,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
        `,
        [
          row.id,
          row.player_id,
          row.nickname ?? null,
          row.race ?? null,
          row.activation_code_id ?? null,
          row.event_access ?? false,
          row.status,
          row.remaining_uses ?? null,
          row.session_token_hash,
          row.issued_at,
          row.last_heartbeat_at,
          row.ended_at ?? null,
          row.end_reason ?? null,
          row.created_at,
          row.updated_at,
        ]
      );
    }

    await resetSequence(client, "admin_users");
    await resetSequence(client, "activation_codes");
    await resetSequence(client, "player_sessions");

    await client.query("COMMIT");

    console.log("导入完成");
    console.log(`admin_users: ${payload.admin_users.length}`);
    console.log(`activation_codes: ${payload.activation_codes.length}`);
    console.log(`player_sessions: ${payload.player_sessions.length}`);
    console.log("admin_login_guards 不在导入范围内，将在新系统中重新累积");
    console.log("存量码 max_uses 已统一置为 NULL（不限次），不会被判次数耗尽");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("导入失败:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("导入脚本异常退出:", error);
  process.exit(1);
});
