# 安全文档索引

先读这一页。这里的文档分两类：**现行**描述应当遵守的规则和当前设计；**历史**记录写作当天的状态、路径和操作步骤，按 [仓库布局](../repository-layout.md) 的旧→新对照换算，不能当作线上现状。

线上真实状态（Cloudflare、DNS、Tunnel、香港服务器、本机自启任务）只以最新的只读证据为准，不以任何文档为准。最近一次完整审计：工作区 `evidence/security-audit-20261026/`（报告、Cloudflare 只读快照、SSH 分阶段探测、旧运维副本取证与变更记录）。

## 现行

| 文档 | 内容 |
| --- | --- |
| [security-baseline.md](security-baseline.md) | 目标基线（证据部分为 10-16 快照） |
| [access-control-matrix.md](access-control-matrix.md) | 角色与接口权限 |
| [attack-surface.md](attack-surface.md) | 入口与攻击面清单 |
| [content-exposure-map.md](content-exposure-map.md) | 公开 / 受限内容与原图边界 |
| [scraping-baseline.md](scraping-baseline.md) | 防爬与滥用的分层原则 |
| [logging-baseline.md](logging-baseline.md) | 日志内容与脱敏要求 |
| [listener-baseline.md](listener-baseline.md) | 监听地址规则 |
| [incident-response.md](incident-response.md) | 事故处置的前 15 分钟 |
| [csp-migration-plan.md](csp-migration-plan.md) | CSP 收紧计划 |
| [security-question-migration.md](security-question-migration.md) | 找回问题的迁移 |

代码中的现行控制：入口 Host / 转发头 `services/platform/host_policy.py`、域名表 `packages/site-domains/domains.json`（见 [域名 readiness](../domain-readiness.md)）、Turnstile `services/platform/turnstile.py`（`TURNSTILE_SECRET` 未设置时关闭，配置见 `services/platform/.env.example`）、会馆登录限流 `apps/huiguan/server_huiguan.py` 的 `LOGIN_FAILURE_LIMITS`。

## 历史（不要照做其中的路径和命令）

| 文档 | 当时的用途 |
| --- | --- |
| [SECURITY_BASELINE_REPORT.md](SECURITY_BASELINE_REPORT.md)、[operations-security.md](operations-security.md) | 10-16 基线证据 |
| [STAGE1_REMEDIATION_REPORT.md](STAGE1_REMEDIATION_REPORT.md)、[STAGE1_5_PRODUCTION_VERIFICATION.md](STAGE1_5_PRODUCTION_VERIFICATION.md)、[STAGE1_6_OPERATIONAL_HARDENING.md](STAGE1_6_OPERATIONAL_HARDENING.md) | 阶段 1 修复与本机生产时期的加固 |
| [STAGE1_8_1_RELEASE_RECOVERY.md](STAGE1_8_1_RELEASE_RECOVERY.md)、[STAGE1_8_2_EPERM_HOLDER.md](STAGE1_8_2_EPERM_HOLDER.md)、[STAGE1_8_3_HOTFIX_PROVENANCE.md](STAGE1_8_3_HOTFIX_PROVENANCE.md)、[STAGE1_8_3_RELEASE_CANDIDATE.md](STAGE1_8_3_RELEASE_CANDIDATE.md)、[STAGE1_8_3_RELEASE_CHECKLIST.md](STAGE1_8_3_RELEASE_CHECKLIST.md) | 1.8.x 发布与恢复 |
| [STAGE1_8_ANTI_SCRAPING_PRODUCTION.md](STAGE1_8_ANTI_SCRAPING_PRODUCTION.md)、[ANTI_SCRAPING_SECURITY_RECHECK_20261019.md](ANTI_SCRAPING_SECURITY_RECHECK_20261019.md) | 防爬上线与复查 |
| [WEB_CHECK_OUTSIDE_IN_REPORT.md](WEB_CHECK_OUTSIDE_IN_REPORT.md)、[csp-observation-20261016.md](csp-observation-20261016.md)、[csp-observation-stage1.6.md](csp-observation-stage1.6.md) | 外部视角检查与 CSP 观察 |
| [ZSZM-RECOVERY-20261024.md](ZSZM-RECOVERY-20261024.md)、[LUNA6-PRODUCTION-RESTORE-20261024.md](LUNA6-PRODUCTION-RESTORE-20261024.md) | 10-24 域名事故恢复手册（`E:/Projects/ops`、`server/` 等均为旧路径；其中的 Cloudflare 设置已在 10-26 被改动，见审计证据） |

## 规则

- 生产、Cloudflare、DNS、Tunnel、香港 SSH 配置的任何改动先存只读快照，再写变更记录与回滚方法；没有记录的线上改动视为待查。
- 不在文档、日志、证据或聊天中写入 secret 的值；只记录存在性、位置、ACL 与指纹。
- 新的审计或事故写成 `evidence/<主题-日期>/`，这里只更新索引，不再增加平行的长报告。
