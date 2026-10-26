# 生产运维资产快照（服务器态）

> ⚠️ **这些文件不是代码，是当前生产服务器上实际运行中的配置与脚本。**
> 它们原本只存在于服务器磁盘（`154.222.26.70`），服务器重装即丢失。
> 本分支的目的是**先把它们存进版本控制**，最终放在仓库的哪个位置、怎么纳入发布流程，**由维护者决定**。

采集时间：2026-10-26
采集自：香港生产服务器 `154.222.26.70`

---

## 文件清单

| 文件 | 生产路径 | 说明 |
|---|---|---|
| `iridescently-db-snapshot.sh` | `/usr/local/sbin/iridescently-db-snapshot.sh` | 每日数据库一致性快照脚本（cron `15 4 * * *`） |
| `zszm.nginx.conf` | `/etc/nginx/conf.d/zszm.conf` | 站点 nginx 配置（8 个域名、缓存策略、弹窗注入、安全规则） |
| `zszm-hk.tunnel.yml` | `/etc/cloudflared/zszm-hk.yml` | Cloudflare Tunnel ingress 配置（9 条 hostname） |
| `test-harness-ciheaders.patch` | —（待应用） | 修复 `security_ingress_test.py` 响应头大小写敏感导致的验收误报 |

---

## 1. `iridescently-db-snapshot.sh` — 每日快照

**作用**：每天 04:15 用 `sqlite3 .backup`（只读、不锁库）快照 4 个数据库，保留 14 天。

```bash
snap /srv/iridescently/data/portal/huiguan/users.db                    # 用户/会话/存档/画廊互动
snap /srv/iridescently/data/data/homepage-gallery.sqlite3              # 主页画廊
snap "/srv/iridescently/data/assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db"
snap /srv/iridescently/data/server/app/src/cards/update-feedback.sqlite3
```

**输出**：`/root/dsh-backups/daily/<YYYYMMDD>/`，日志 `/var/log/iridescently-snapshot.log`

**为什么重要**：当前生产 4000+ 用户，这个脚本是唯一自动化的数据保护手段。之前发现过一次差距：最新备份是 10-24 的 3244 用户，而线上已经 4038 用户——**794 个用户的账号、存档、上传完全没有备份**。

**待决定**：
- 放在仓库的哪个目录（建议 `infra/ops/` 或 `tools/ops/`）
- 是否纳入发布流程自动部署
- 是否需要异地副本（目前服务器备份与本机备份各一份）

---

## 2. `zszm.nginx.conf` — nginx 配置

**包含的关键配置**：

| 段落 | 内容 |
|---|---|
| 域名 | 8 个 `server_name`（主站/会馆/众生之门/OC 等） |
| 缓存策略 | `map $uri $zszm_cache_ctl`：哈希产物 `immutable` 一年、图片 7 天、其余 `no-cache` |
| 弹窗注入 | `sub_filter '<head>'` 注入 `selector.js` 与 `notice.js` |
| 静态路由 | `/assets/`、`/shared/`、`/app/modules/` 的代理与缓存 |
| 安全 | 危险后缀 404、伪造 Host 拒绝、`/__pycache__` 等目录屏蔽 |

**注意**：配置里的 `$zszm_cache_ctl` 策略在**源站已生效**（验证返回 `no-cache`），但被 Cloudflare 的 Browser Cache TTL(4h) 覆盖。需要在 Cloudflare 面板把该项改成「尊重现有标头」。

**待决定**：是否拆分成 `infra/nginx/` 下的多个片段文件、是否需要模板化（域名/路径变量化）。

---

## 3. `zszm-hk.tunnel.yml` — Cloudflare Tunnel

9 条 hostname ingress，全部指向 `http://127.0.0.1:8080`，末尾 `http_status:404` 兜底：

```
iridescently.xyz / www / huiguan / oc / spirit / game / juling / lingjing / zszm
```

**注意**：其中 `www` / `spirit` / `game` / `juling` / `lingjing` **隧道有配置但 DNS 没有记录**，实际打不开。

**待决定**：清理无效 hostname、补充缺失的 DNS 记录、或按新域名体系重建。

---

## 4. `test-harness-ciheaders.patch` — 验收脚本修复

**问题**：`server/security_ingress_test.py` 用 `dict(response.getheaders()).get("Location")` 读响应头，**大小写敏感**。HTTP/2 与 Cloudflare 会把头名转成小写 `location`，导致新引入的 302 被误判为「missing Location」，验收失败。

**修复**：新增 `CIHeaders` 类，构造时键名统一小写，`get`/`__getitem__`/`__contains__` 全部大小写无关。

**影响**：不修则每次 V19/V20 公网矩阵验收都会误报失败。

**待决定**：直接合入主线，还是作为独立 `fix/` 分支。

---

## 维护者需要决定的四件事

1. **存放位置**：`infra/`（新布局已有该目录）还是 `tools/`？
2. **是否模板化**：域名/路径是否抽成变量，避免以后改域名要改多处
3. **是否需要脱敏**：当前配置里没有密钥，但 tunnel 配置引用了 `credentials-file` 路径
4. **是否纳入发布流程**：这些配置变更时，是否要经过部署器而不是手工改服务器

---

## 相关背景

- 生产版本：`20261025T114245Z`，自检 71/71 passed
- 仓库已迁移到新布局（`apps/services/packages/tools/infra`），本快照是**旧布局时期的服务器状态**
- 其余生产热修已推送到独立分支（见 `docs/changelog/PRODUCTION_CHANGES_20261026.md`）

