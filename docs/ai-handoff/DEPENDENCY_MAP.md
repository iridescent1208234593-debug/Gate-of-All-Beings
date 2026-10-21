# Dependency Map

## 共享身份（公共账户 / SSO）

- **真值**：会馆 `portal/huiguan/users.db`。表：`local_users`、`users`（USSO）、`user_flags`、`account_profiles`（主键 `(kind, uid)`）、email / recovery / security 相关表。
- **会话**：`hx_sso` 签名 cookie（`server/hx_sso.py`）。会馆、门户、Cards 5174 共用。
- `server/account_profile.py`（未跟踪）的 `resolve_sso_identity()` 只接受 `kind ∈ {local, usso}`：
  - local 需要 `status=active`；
  - usso 只检查 banned。
- **管理员**：`ADMIN_USSO_IDS = {"7"}`，只在 usso 分支判断。若常量为空且没有 local 用户，首个注册者会成为 admin（目前休眠）。
- 详细边界见 [zszm-identity-and-save-map.md](../zszm-identity-and-save-map.md)。

### `(kind, uid)` 风险清单

| 风险 | 位置 | 状态 |
| --- | --- | --- |
| **云存档用 bare uid**：local N 与 usso N 共享记录 | 旧实现仍在线上快照中 | **源码已修**（`600633c`，`server/game_saves.py`），待发布，见 [game-save-ownership.md](../game-save-ownership.md) |
| 主站 `_is_admin` 裸 uid + `kind == "admin"` | `portal/www/server.py` → `server/site_admin.py` | **已修**（`6a11118`）：完整 `(kind, uid)` 名单 + 账户库复核；未部署 |
| OC 键不对称：`local:<uid>` vs bare usso uid | `server_huiguan.py` `_data_key`、`cards/server.py` `_owned_ocs` | 现行约定；旧数据迁移未知 |
| admin 删除角色接口接受原始 key | `server_huiguan.py` 约 3270 | 未核对 |
| Gate `expected_owner` 守卫可选 | `cards/server.py` POST `/api/gate/identity` | 已在文档中承认 |
| `shared-session` 类型 `kind?: string` 为可选 | `shared/shared-session/session.d.ts` | 客户端容易用 bare uid 比较 |
| 账户切换 | 无专门实现；Gate 编辑器按 `${kind}:${user_id}` 重挂 | — |

## 共享组件 / 资源

- `shared/shared-ui` 是设计系统真身，`portal/huiguan/design-system/ui` 是指向它的 junction（被 git 忽略）。删除 `shared-ui` 素材会同时影响会馆。
- Cards 前端跨域加载：huiguan `design-system.css`、`avatar-cropper.{css,js}`（已提交，未上线），以及主站 `assets/site-language.js`。
- 门庭模块清单：`server/app/portal.json`。统一壳：`server/app/shell/index.html`。
- slay（重生之门）构建从 `shared/shared-ui/AI image/images` 复制素材（`build-modules.mjs:70`）。该目录已按复审删除；`541aec6` 起改为可选来源 `server/app/module-assets.json`。

## 后端 / 发布耦合

| 组件 | 运行来源 |
| --- | --- |
| 8080 门户、5174 Cards API | `.releases/production/site` 快照（管家设 `IRIDESCENTLY_PROJECT_ROOT=E:\Projects` 指回运行数据） |
| 5177 聚灵 | 工作树源码 |
| 5178 数值、4173 灵体 | 已发布模块 |

- **`publish:cards` ↔ `publish:site` 必须同步**：新前端调用 `/api/gate/identity`、`/api/gate/ocs`，依赖新的 `cards/server.py` 和 `account_profile.py`。单独发布前端会导致线上身份接口 404。
- `build:site` 应从 Git HEAD 导出，因此未提交的改动进不了正式快照。但当前线上快照是手工组装的，见 [PROJECT_TRUTH §3](PROJECT_TRUTH.md#3-生产运行真相最重要)。

## 跨仓库 / 跨目录

| 依赖方 | 依赖 E:\Projects 的什么 |
| --- | --- |
| 线上 portal `/ozmtree`（手改） | `E:\External Projects\众生之门生物树可视化前端\OZtree\static` |
| research playable-slice | `@production-ecology` → `IRIDESCENTLY_PROJECT_ROOT`（默认 `E:/Projects`） |
| Anime2AnimatedSVG | `assets/罗小黑战记数据库/videos` |
| 素材复审记录 | `assets/罗小黑战记数据库/images` |
| url-wallpaper | 默认加载 `https://iridescently.xyz/`（未提交） |

## 数据（不在 Git 中，需要单独备份）

`portal/huiguan/{users.db, characters.json, game_saves.json, assets/uploads}`、`server/app/src/cards/users.db`、`server/app/src/juling/data/save.db`、`assets/罗小黑战记数据库/`。

`ops/backups/` 和 `work/restore-drill/databases/` 中有生产用户库副本，保持不入 Git、不外传。
