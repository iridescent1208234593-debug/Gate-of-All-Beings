# 对接文档：入世历练 / 重生之门 / 六系演武 —— 后端数据去留（交给 Codex 决策）

> **Codex 实施更新（2026-10-19）**：共享数据与 Cards/Slay 迁移已在本地源码实现，尚未发布。当前有效角色为 439 名，另保留 49 个已合并旧 ID 跳转；正式角色、灵卡、进度类型及读写方式见 [共同旅途 README](./README.md)。下文保留原始交接记录，不代表最新实现或待执行指令。

> 写于 2026-10-19，Claude。事实部分都已在本机核对过，标"未验证"的除外。
> 分工：**后端数据合并由 Codex 决定并实施**；**合并后的前端视觉由 Claude 做**。双方以本文第五节的"数据契约"对接。
> 用户的目标：众生之门里两个卡牌游戏合并前端，数据统一到六系演武这套已经清洗过的角色数据上。

---

## 一、三个对象是什么

| | 入世历练 | 重生之门 | 六系演武 |
|---|---|---|---|
| 位置 | `server/app/src/cards`（门庭内 `#adventure`） | `server/app/src/slay-the-web`（壳 `/app/shell/m/slay`，静态目录 `/app/modules/slay/`） | 数据与集成包，**工作树里已删**，在 git `431f167^` 里完整保留 |
| 技术 | React + TS + Vite；纯函数引擎 `src/game/core/*` | 原生 JS（开源 Slay the Web 的 fork），无构建：`public/game` 引擎、`public/ui` 界面、`public/content` 内容（50 个文件） | JSON 数据 + Python 生成脚本 + TSX 接入组件 |
| 玩法 | 类杀戮尖塔：3 名英雄（小黑/无限/风息），地图、战斗、商店、休憩、事件；元层的日结算、灵质、草药、羁绊、封灵、生态兑换 | 也是类杀戮尖塔：66 张五行卡，外加大量世界观内容（角色档案、羁绊、修行、灵质派系、结局等） | 488 名角色的确定性数值（hp/atk/def、element、realm、power 分档、稀有度）、488 套卡组、15 个成就、六系定义 |
| 存档 | 浏览器 **IndexedDB** `zszm-adventure-v1`，并通过 `@lxh/shared-session/kv.js` 的 `unifiedStorage('cards')` 镜像一份摘要 | 浏览器 **localStorage**（`game/save-system.js`、`game/lingzhi-progress.js`、多个 content 文件各自读写） | 无运行时存档，只有静态数据 |
| 服务端 | 5174 `cards/server.py`：OAuth、`/api/user`、`/api/sso-user`、`/api/gate/identity`、`/api/gate/ocs`；5178 数值服务 `server/cardBalanceServer.ts`，数据在 `cards/data/card-balance`（香港 `data/` 下） | 无。`game/backend.js` 还写着往第三方 `https://api.slaytheweb.cards/api/runs` 上报对局，**目前没有调用点**，属于死代码 | 无 |

两个游戏的引擎其实是**同一种玩法写了两遍**。五行 key 已经一致：`jin/mu/shui/huo/tu` 加上 `kongjian`，入世历练的 `Card.element` / `Card.school` 字段也预留好了。

## 二、六系演武数据怎么取回

工作树里只剩 `docs/39~52` 复审记录，数据和代码在 2026-10-14 的 `431f167`（"retire legacy entries"）里被一起删掉了。恢复的时候只取需要的部分，不要整个目录 checkout 覆盖：

```powershell
cd E:\Projects
git ls-tree -r --name-only 431f167^ -- "New project/six-system-arena"   # 先看清单
git show "431f167^:New project/six-system-arena/data/stat-model.json"   # 逐个取
```

要点：
- 主数据源是 `assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db`（只读）。**香港上那份才是权威**，Windows 这份已经冻结。
- 素材红线复审（1485 张）在旧数据之后才收口，期间还做了删图和移到未定区。所以 `character_stats.json`、`decks.json` 里引用的图片和角色，**必须用 `data/scripts/generate_stats.py` 对照当前 DB 重新生成**，不能直接用旧 JSON。
- 2026-10-18 香港 DB 刚删掉 `配音演员山新*.png` 两条记录（真人照，Codex 正在执行）。重新生成数据要在这一步之后做。
- 设计依据见历史里的 `docs/01-数值模型.md`、`07-站点集成方案.md`、`08-现有游戏数值基线登记.md`、`integration/INTEGRATION-ZSZM.md`。

## 三、需要 Codex 决定的事（每项给结论和理由）

1. **角色真源**：建议以六系演武的 `character_stats`（按 DB 的 character_id 作键）作为唯一角色表。入世历练的 3 名英雄、重生之门 `content/characters-full.js`、`character-profiles.js`、`enemy-profiles.js` 都映射到 character_id。需要决定：重生之门那批内容文件是迁成数据、保留成只读引用，还是废弃。
2. **卡牌真源**：入世历练有 25 张基础卡、70 张 legacy、3 张生态卡；重生之门有 66 张；六系演武有 488 套卡组。决定合并后的卡池、去重规则（同名、同效果），以及 `cardBalance.ts` 的 18 项效果字段是否作为统一卡牌 schema（建议是，因为它已经有校验和上限）。
3. **数值去留**：入世历练英雄 HP 是 72–80 这种小数值，六系演武是 800–6400 的大数值，量级不一样。决定换算方式：比如六系数值只用来做相对强弱和分档，战斗里换算成小数值。
4. **存档统一**：IndexedDB 和 localStorage 两套存档，加上用户要的"重伤 / 陨落 / 5 小时复活 / 全员陨落转重生之门"，这些状态现在只在入世历练的本地存档里（`core/meta.ts` 的 `heroState / allHeroesDead / reviveIfDue`）。决定：
   - 角色伤势、资源（灵质、草药）是否两个模式共享；
   - 存档是否上服务端（登录用户按账户存，匿名用户留在本地）。上服务端的话，要接入现有 `users.db` 和会话体系，并且遵守"香港单主写"的原则，和服务器并联方案对齐（见 `work/hk-bandwidth/CODEX-服务器并联与后端分区-提示词.md`）；
   - 旧存档的迁移和兼容（`checkSave` 现在只认 `version:1`）。
5. **服务端接口**：是否新增统一的 `/api/cards/*`（角色表、卡池、存档读写），还是继续走前端静态 JSON 加本地存档。5178 数值服务要不要扩展成覆盖两个模式。
6. **要删的东西**：`slay-the-web/public/game/backend.js` 的第三方上报（建议删掉）、`powers_20260830_055429_247.js` 这类备份文件、`xiuxian-card/` 子项目（确认有没有入口在用）。

## 四、约束

- 香港是数据权威源。不要从 Windows 往香港推 DB 或用户文件，改香港数据前先 `sqlite3 .backup`。
- 代码发布只走 `ops/hk-release.py` → `release_control.py`。注意：`hk-release.py` 已经被我改成保留文件真实 mtime（原来 mtime=0，会导致源站对所有 If-Modified-Since 都回 304，浏览器永远拿旧页面）。**这项修复还没发布**，下一次发布会顺带上线；发布后请验证带 IMS 的请求能返回 200。
- `git add` 只加具体路径，禁止 `-A`。工作树里有很多并行会话没提交的改动（`ops/*` 服务器管家、`portal/huiguan/*`、`cards/server.py` 多线程改动等），不要误带。
- 素材红线：只能用复审保留的官方图，禁止同人、AI 生成、真人图。
- 入世历练重玩机制已经提交为 `360d41b`（线上本来就有），测试 23/23 通过。

## 五、给前端的数据契约（Codex 定稿后填这一节，Claude 照此做界面）

Codex 决定后，请把下面几项写清楚，或者给出 TS 类型文件路径（建议放 `shared/shared-types/`）：

- `Character`：id、名称、element / systems、realm、稀有度、power 档、立绘 URL（走 `/api/official/img?cid=` 还是别的）、伤势状态。
- `Card`：统一 schema（含 element / school、费用、效果字段、来源模式）。
- `Progress`：资源、角色伤势 / 陨落 / 复活时间、两个模式各自的局内状态。
- 读写方式：静态 JSON 路径还是 API 路由，登录和匿名分别怎么走，失败时前端怎么降级。

前端这边会先按"一个入口、两个模式（入世历练 / 重生之门）、共享角色名册和资源栏"来设计。数据契约没定稿之前，只做视觉和交互，不碰存档格式。
