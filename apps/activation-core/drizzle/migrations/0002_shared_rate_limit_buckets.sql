-- ============================================================
-- 迁移 0002：客户端接口频率限制改为数据库共享计数（#43 M13）
--   原实现为进程内 Map：多实例 / Serverless 各算各的，重启即清零。
--   新表只存限流键摘要与窗口计数，不含用户数据；过期行可随时删除，回滚时直接 DROP。
-- ============================================================

CREATE TABLE "rate_limit_buckets" (
	"bucket_key" varchar(128) PRIMARY KEY NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_request_count_check" CHECK ("rate_limit_buckets"."request_count" >= 0),
	CONSTRAINT "rate_limit_buckets_window_check" CHECK ("rate_limit_buckets"."expires_at" > "rate_limit_buckets"."window_started_at")
);
--> statement-breakpoint
CREATE INDEX "idx_rate_limit_buckets_expires_at" ON "rate_limit_buckets" USING btree ("expires_at");
