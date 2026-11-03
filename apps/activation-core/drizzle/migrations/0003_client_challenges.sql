-- ============================================================
-- 迁移 0003：客户端一次性 challenge，响应签名防重放服务端化（#45 M15）
--   原实现的 nonce 由服务端随机生成后不再登记，防重放全靠客户端内存缓存。
--   新表只存 challenge 摘要、设备标识与有效期；过期行可随时删除，回滚时直接 DROP。
-- ============================================================

CREATE TABLE "client_challenges" (
	"challenge_hash" varchar(64) PRIMARY KEY NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"route" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_challenges_route_check" CHECK ("client_challenges"."route" in ('/api/client/verify', '/api/client/activate')),
	CONSTRAINT "client_challenges_window_check" CHECK ("client_challenges"."expires_at" > "client_challenges"."created_at")
);
--> statement-breakpoint
CREATE INDEX "idx_client_challenges_expires_at" ON "client_challenges" USING btree ("expires_at");
