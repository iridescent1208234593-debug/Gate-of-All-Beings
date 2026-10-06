# sixsys-zszm-integration · zszm 端口集成包（R3）

> 把「六系演武」的**六系能力数值 + UI 图标**接入 zszm 端口（众生之门）的**卡牌 / 经营 / 模拟**三系统可视化。
> 本包是 **arena → zszm 的单向交付物**：arena 为唯一真源，zszm 侧只接收副本，**不反向写回**。
> 配套文档：`../../docs/07-站点集成方案.md`、`../../docs/08-对战与成就落地.md`

---

## 0. 边界与红线（最高优先级）

| 约束 | 说明 |
|---|---|
| 不修改参考仓库 | `D:\Projects\zszm`、`E:\Projects\shared\shared-ui`、`worldview_luoxiaohei_v4.db` 一律不动；安装动作由用户在本包指引下执行 |
| 零侵入接入 | 复用 zszm 既有 `LxhIcon` / `window.LXHUI.ICONS`、`Card.school` / `Card.element`、`CardTile` / `CardCollection` / `GameApp` 胜败结算位，**不改造既有组件** |
| 素材红线 | 仅《罗小黑战记》官方图；严禁 AI 生图；严禁同人图；**本轮不联网采集**（见 `docs/05`） |
| 图标来源 | 六系图标来自 arena 侧已重绘内联的 `ui/six-system-icons.js`，本项目运行不依赖 `AI image/` 目录 |
| 失败不惩罚 | 失败结算只做情绪安抚，不扣资源、不掉进度、不判定成就 |

---

## 1. 包结构

```
integration/
├─ README.md                  ← 本文件
├─ manifest.json              ← 交付清单 + 落点 + 每条文件的 sha256（供漂移检测）
├─ INTEGRATION-ZSZM.md        ← 逐步安装与挂载指南（可直接照做）
├─ js/                        ← 可直接 <script> 引入的运行时（arena 侧同步副本）
│  ├─ six-system-icons.js     ← 六系图标（自注册到 window.LXHUI.ICONS）
│  └─ settlement.js           ← 胜负结算引擎（window.SixSystemSettlement）
├─ src/                       ← zszm 侧 React/TS 接入层（拷入 src/game/sixsys/）
│  ├─ sixsys-types.ts         ← 类型契约
│  ├─ sixsys-assets.ts        ← 官方素材清单与路径→URL 映射
│  ├─ sixsys-data.ts          ← 数据桥（加载 488 角色 / 卡组 / 成就 + 六维取值）
│  ├─ SixSystemPanel.tsx      ← 数值面板（复用 arena 的 SixSystemPanel.js）
│  ├─ SettlementStage.tsx     ← 胜负结算舞台（小黑 & 比丢正向反馈 / 失败安慰）
│  ├─ AchievementBanner.tsx   ← 成就解锁条
│  └─ index.ts                ← 统一出口
├─ styles/
│  └─ sixsys-integration.css  ← 全部选择器以 sixsys- 前缀，避免与既有样式冲突
├─ data/                      ← 站点静态数据（拷入 public/sixsys/data/）
│  ├─ character_stats.json    ← 488 角色六系数值
│  ├─ decks.json              ← 488 套卡组
│  ├─ achievements.json       ← 15 条收集类成就
│  ├─ six-systems.json        ← 六系定义（颜色 / 图标 key / 克制）
│  └─ stat-model.json         ← 数值模型（可追溯口径）
└─ verify/
   ├─ install_assets.ps1      ← 官方素材 → public/sixsys/official/（只复制，不改画）
   ├─ verify_integration.py   ← 交付自检（文件齐全 / 哈希一致 / 素材存在 / 内容红线）
   ├─ smoke_integration.mjs   ← 冒烟测试（结算与面板契约）
   └─ verify_report.json      ← 自检产物（运行后生成）
```

---

## 2. 三系统接入点总表

| 系统 | zszm 接入点（既有文件） | 接入方式 | 使用组件 | 数据 |
|---|---|---|---|---|
| 卡牌 | `src/game/GameApp.tsx` → `CardTile` | `Card.school` / `Card.element` 已有字段直取；系别徽标改为六系图标 | `SixSystemPanel`（角色详情） | `character_stats.json` / `decks.json` |
| 卡牌（图鉴） | `src/game/CardCollection.tsx` | `renderCard` 注入六系图标；卡背徽标复用 `LxhIcon` | `LxhIcon name="jin"` 等六键 | `six-systems.json` |
| 卡牌（结算） | `src/game/GameApp.tsx` → `run.phase === 'victory' \| 'defeat'` 区块 | 在结局区内挂 `<SettlementStage run={run} />` | `SettlementStage` | `settlement.js` |
| 经营 | `src/game/ManagementPanel.tsx` | iframe 传参 `?sixsys=1`，经营侧按六系加成维度读取 | `SixSystemPanel`（据点加成面板） | `six-systems.json` + `decks.json` |
| 模拟（灵境生态） | 生态页个体详情 | `EcoIndividual.element` 已是 `Element` 类型，直接映射六系（土/水/木/火/金） | `LxhIcon` | `six-systems.json` |
| 通用 | `src/game/LxhIcon.tsx` | **无需改动**：加载 `js/six-system-icons.js` 后六键自动进入 `window.LXHUI.ICONS` | — | — |

> 关键点：`LxhIcon` 已是 `window.LXHUI.ICONS[name]` 的薄封装，**新增六键后 `<LxhIcon name="jin" />` 即刻可用**，无需改 zszm 任何既有组件。

---

## 3. 安装（三步）

### 3.1 复制文件

```powershell
$Arena = 'E:\Projects\New project\six-system-arena'
$Zszm  = 'D:\Projects\zszm'

# ① 运行时 JS → public/sixsys/
New-Item -ItemType Directory -Force "$Zszm\public\sixsys" | Out-Null
Copy-Item "$Arena\integration\js\*" "$Zszm\public\sixsys\" -Force

# ② 静态数据 → public/sixsys/data/
New-Item -ItemType Directory -Force "$Zszm\public\sixsys\data" | Out-Null
Copy-Item "$Arena\integration\data\*" "$Zszm\public\sixsys\data\" -Force

# ③ 接入层源码 + 样式 → src/game/sixsys/
New-Item -ItemType Directory -Force "$Zszm\src\game\sixsys" | Out-Null
Copy-Item "$Arena\integration\src\*" "$Zszm\src\game\sixsys\" -Force
Copy-Item "$Arena\integration\styles\sixsys-integration.css" "$Zszm\src\game\sixsys\" -Force

# ④ 官方素材 → public/sixsys/official/（只复制，不改画；见 §5）
powershell -ExecutionPolicy Bypass -File "$Arena\integration\verify\install_assets.ps1"
```

### 3.2 在入口引入运行时（`index.html` 或 `main.tsx`）

```html
<!-- 必须位于 lxh-ui.js 之后 -->
<script src="/sixsys/six-system-icons.js"></script>   <!-- 自动注册 jin/mu/shui/huo/tu/kongjian -->
<script src="/sixsys/settlement.js"></script>          <!-- window.SixSystemSettlement -->
```

### 3.3 挂载组件

```tsx
// 卡牌：旅途结局区（GameApp 的 victory / defeat 区块内）
import { SettlementStage } from './sixsys';

{run && ['victory', 'defeat'].includes(run.phase) && (
  <SettlementStage
    result={run.phase === 'victory' ? 'win' : 'lose'}
    mode="story"
    opponentId={lastOpponentId}
    opponentName={lastOpponentName}
    winnerElement={run.heroElement}
    seed={run.seed + run.log.length}
    onRetry={() => go('home')}
  />
)}

// 卡牌：角色详情页数值面板
import { SixSystemPanel } from './sixsys';

<SixSystemPanel characterId={1} />

// 成就解锁条（结算后错峰弹出，见 docs/04 §6）
<AchievementBanner achievements={newlyUnlocked} />
```

完整可复制片段与三种挂载（面板 / 结算 / 成就）见 [`INTEGRATION-ZSZM.md`](./INTEGRATION-ZSZM.md)。

---

## 4. 组件 API

### 4.1 `SixSystemPanel`（React）

| 属性 | 类型 | 说明 |
|---|---|---|
| `characterId` | `number` | 角色 id（488 选 1），从 `character_stats.json` 取数 |
| `character` | `SixSystemCharacter` | 也可直接传记录，优先级高于 `characterId` |
| `values` | `number[6]` | 覆盖六维（金 木 水 火 土 空间）；缺省时按记录推导 |
| `tier` / `subtitle` / `source` | `string` | 透传展示字段 |

渲染时优先调用 arena 的 `window.SixSystemPanel.renderFromRecord()`；该 API 缺失时回落到 `render()` + 本地六维推导，保证不白屏。

### 4.2 `SettlementStage`（React）

| 属性 | 类型 | 说明 |
|---|---|---|
| `result` | `'win' \| 'lose' \| 'draw'` | 胜负（draw 走安抚流程，不惩罚） |
| `mode` | `'story' \| 'arena' \| 'challenge' \| 'mirror'` | 影响文案分支 |
| `opponentType` | `'official' \| 'mirror'` | 镜像战走专属文案，且不计入角色胜利收藏 |
| `opponentId` / `opponentName` | `number` / `string` | 用于「第一次赢下『X』」 |
| `firstTimeDefeat` / `winStreak` | `boolean` / `number` | 文案分支输入 |
| `winnerElement` | `SixSystemKey` | 六系图标高亮 |
| `seed` | `number` | 确定性抽取（同种子同文案同安慰图） |
| `onRetry` / `onFinish` | `() => void` | 回调 |

内部调用 `window.SixSystemSettlement.resolve(ctx)` 拿到**时间轴**并按时序播放；引擎缺失时使用本地兜底（与 `docs/04` 文案逐字同源）。素材路径经 `sixsys-assets.ts` 映射为站点 URL。

### 4.3 `AchievementBanner`（React）

| 属性 | 类型 | 说明 |
|---|---|---|
| `achievements` | `SixSysAchievement[]` | 本场新解锁的成就 |
| `delayMs` | `number` | 默认 3000，与胜利结算错峰（`settlement.achievement.show_after_ms`） |

### 4.4 数据桥 `sixsys-data.ts`

```ts
const bridge = await loadSixSystemData();   // 内部 fetch('/sixsys/data/*.json')，带内存缓存
bridge.byId(1);                              // → 罗小黑
bridge.byElement('tu');                      // → 土系角色列表
bridge.tierAtLeast(1, 'C');                  // → true
bridge.systemValues(1);                      // → [88,62,70,55,60,95]
bridge.elementCounter();                     // → { jin:33, mu:27, ... }
```

也可由站点**预注入**（避免首次 fetch 抖动）：

```html
<script>window.SIXSYS_DATA = { character_stats: {...}, decks: {...}, achievements: {...} };</script>
```

---

## 5. 素材处理（官方图）

| 逻辑 id | 官方原文件（只读源，`E:\Projects\assets\`） | 站点落点 |
|---|---|---|
| `luoxiaohei_full` | `罗小黑战记数据库\images\罗小黑\罗小黑_全身_085.jpg` | `public/sixsys/official/luoxiaohei_full.jpg` |
| `luoxiaohei_face_01` | `罗小黑战记数据库\images\罗小黑\罗小黑_表情_087.jpg` | `public/sixsys/official/luoxiaohei_face_01.jpg` |
| `luoxiaohei_face_02` | `罗小黑战记数据库\images\罗小黑\罗小黑_表情_088.jpg` | `public/sixsys/official/luoxiaohei_face_02.jpg` |
| `bidiu` | `罗小黑战记数据库\images\比丢\比丢.png` | `public/sixsys/official/bidiu.png` |
| `bidiu_anim` | `罗小黑战记数据库\images\比丢\比丢.gif` | `public/sixsys/official/bidiu.gif` |

- 复制方式：`integration/verify/install_assets.ps1`（**只复制，等比缩放/矩形裁切之外不做任何处理**；不改画、不加滤镜、不去水印）。
- 浏览器无法直接加载 `E:\...` 绝对路径，因此 `sixsys-assets.ts` 提供 `toSiteUrl(absPath)`：按**文件名**映射到 `/sixsys/official/`。
- 未安装素材时组件**不会白屏**：`resolveAssetWithFallback()` 回落为六系图标 + 文案，并在控制台给出提示。
- 本轮**未联网采集**任何素材；失败安慰图沿用官方素材库既有表情图（见 `docs/05` §5 审查留痕）。

---

## 6. 自检与回滚

```powershell
# 交付自检：文件齐全 + sha256 与 manifest 一致 + 官方素材存在 + 内容红线（无 ai-art / 同人 / 外链）
python "integration\verify\verify_integration.py"
python "integration\verify\verify_integration.py" --refresh-hashes   # 内容变更后刷新 manifest 哈希

# 冒烟测试：结算契约（胜负时长/文案/素材/不惩罚）+ 面板契约
node "integration\verify\smoke_integration.mjs"

# 重新同步 arena → integration（arena 侧 ui/ 与 data/ 变更后执行）
powershell -ExecutionPolicy Bypass -File "integration\verify\sync_from_arena.ps1"
```

**回滚**：本包不自动写入 zszm。若已按 §3 复制，删除 `zszm/public/sixsys/` 与 `zszm/src/game/sixsys/`、并移除入口两行 `<script>` 即回到接入前状态；`shared-ui/lxh-ui.js` 的六键补丁回滚见 `data/scripts/patch_lxh_icons.py --rollback`。

---

## 7. 与 six-system-arena 的关系

| 项 | 规则 |
|---|---|
| 单一真源 | `ui/six-system-icons.js`、`ui/settlement.js`、`data/*.json` 真源在 arena；`integration/js`、`integration/data` 为**同步副本** |
| 漂移检测 | `verify_integration.py` 比对 `integration/js/*.js` 与 `../ui/*.js`、`integration/data/*.json` 与 `../data/*` 的 sha256，不一致即报错 |
| 版本 | 本包 `package_version` 与 `manifest.json` 同步；arena 每轮迭代后重跑 `sync_from_arena.ps1` |
| 不反向 | zszm 侧的任何改动不回流 arena；如需调整数值请改 arena 的 `stat-model.json` 后重算重导 |

---

*（本包由《罗小黑战记》非商业同人项目「六系演武」生成，素材版权归原作方所有。）*
