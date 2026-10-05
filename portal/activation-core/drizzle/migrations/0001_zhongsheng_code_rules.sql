-- ============================================================
-- 迁移 0001：众生之门式码规则对齐
--   1) activation_codes 扩展 7 字段 + status 语义切换（unused|used → active|invalidated）
--   2) 新增 player_sessions 玩家会话表
--   3) 存量数据兼容：存量码 max_uses 显式置 NULL（不限次），避免存量已用码被判 exhausted
-- ============================================================

--> statement-breakpoint
-- ---------- 1. activation_codes 扩展字段 ----------
ALTER TABLE "activation_codes" ADD COLUMN "max_uses" integer;
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD COLUMN "used_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD COLUMN "bound_player_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD COLUMN "bound_nickname" varchar(100);
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD COLUMN "revoked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD COLUMN "revoked_by" varchar(50);
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD COLUMN "last_used_at" timestamp with time zone;
--> statement-breakpoint

-- ---------- 2. 存量数据迁移（必须在切换 CHECK 约束之前完成） ----------
-- 存量码的 max_uses 显式置为 NULL：表示不限次。
-- 若沿用列默认 1，存量已用码会被立即判为 exhausted（次数耗尽），导致老码全部失效。
UPDATE "activation_codes" SET "max_uses" = NULL WHERE "max_uses" IS NOT NULL;
--> statement-breakpoint
-- 持久态语义切换：unused / used 统一归入 active（是否过期/耗尽改由派生判定）
UPDATE "activation_codes" SET "status" = 'active' WHERE "status" IN ('unused', 'used');
--> statement-breakpoint
-- 存量已绑定设备的码：已用次数对齐为 1，最近结算时间回填 used_at
UPDATE "activation_codes"
SET "used_count" = 1,
    "last_used_at" = COALESCE("last_used_at", "used_at")
WHERE "used_by_device_id" IS NOT NULL AND "used_count" = 0;
--> statement-breakpoint

-- ---------- 3. 约束与索引 ----------
ALTER TABLE "activation_codes" ALTER COLUMN "status" SET DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "activation_codes" DROP CONSTRAINT "activation_codes_status_check";
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_status_check" CHECK ("activation_codes"."status" in ('active', 'invalidated'));
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_max_uses_check" CHECK ("activation_codes"."max_uses" is null or "activation_codes"."max_uses" >= 1);
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_used_count_check" CHECK ("activation_codes"."used_count" >= 0);
--> statement-breakpoint
CREATE INDEX "idx_activation_codes_bound_player_id" ON "activation_codes" USING btree ("bound_player_id");
--> statement-breakpoint
CREATE INDEX "idx_activation_codes_max_uses" ON "activation_codes" USING btree ("max_uses");
--> statement-breakpoint

-- ---------- 4. player_sessions 会话表 ----------
CREATE TABLE "player_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" varchar(255) NOT NULL,
	"nickname" varchar(100),
	"race" varchar(50),
	"activation_code_id" integer,
	"event_access" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"remaining_uses" integer,
	"session_token_hash" varchar(128) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_sessions_status_check" CHECK ("player_sessions"."status" in ('active', 'ended', 'kicked', 'expired')),
	CONSTRAINT "player_sessions_remaining_uses_check" CHECK ("player_sessions"."remaining_uses" is null or "player_sessions"."remaining_uses" >= 0)
);
--> statement-breakpoint
ALTER TABLE "player_sessions" ADD CONSTRAINT "player_sessions_activation_code_id_activation_codes_id_fk" FOREIGN KEY ("activation_code_id") REFERENCES "activation_codes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "player_sessions_token_hash_unique_idx" ON "player_sessions" USING btree ("session_token_hash");
--> statement-breakpoint
CREATE INDEX "idx_player_sessions_player_id" ON "player_sessions" USING btree ("player_id");
--> statement-breakpoint
CREATE INDEX "idx_player_sessions_status" ON "player_sessions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_player_sessions_player_status" ON "player_sessions" USING btree ("player_id", "status");
--> statement-breakpoint
CREATE INDEX "idx_player_sessions_activation_code_id" ON "player_sessions" USING btree ("activation_code_id");
--> statement-breakpoint
CREATE INDEX "idx_player_sessions_last_heartbeat_at" ON "player_sessions" USING btree ("last_heartbeat_at");
--> statement-breakpoint
CREATE INDEX "idx_player_sessions_issued_at" ON "player_sessions" USING btree ("issued_at");
