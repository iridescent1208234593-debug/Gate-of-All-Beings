---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_04acc5a9c1d711f1884b525400cd780f
    ReservedCode1: OmHc65onfU88grRj8SKneVJ6XR6BudsNegrIOaWqekt31We23MnaiF5uyC3shsEEGE/RO55Vkza4HGe0fJjmBJPelU6clSQhCMOwqSD+IgknALtPPHmtwd4anbwlhiK9m5vlyuRgSaooHHYeN3PJIvl0oM+d8Wtv6jF2x4kLgnjF6QgsnfI01Uy8TfU=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_04acc5a9c1d711f1884b525400cd780f
    ReservedCode2: OmHc65onfU88grRj8SKneVJ6XR6BudsNegrIOaWqekt31We23MnaiF5uyC3shsEEGE/RO55Vkza4HGe0fJjmBJPelU6clSQhCMOwqSD+IgknALtPPHmtwd4anbwlhiK9m5vlyuRgSaooHHYeN3PJIvl0oM+d8Wtv6jF2x4kLgnjF6QgsnfI01Uy8TfU=
---

# INTEGRATION-ZSZM · 集成包逐步安装与挂载指南

> 配套阅读：`README.md`（包结构 / API / 契约）、`../docs/07-站点集成方案.md`（UI 全地图 / A·B·C 三方案 / 短分支建议）
> 目标：把 **六系图标 + 六系数值面板 + 胜负结算** 接入 zszm 端口（众生之门）的 **卡牌 / 经营 / 模拟** 三套系统。
> 总原则：**不改既有组件、不写参考仓库、不做映射表**；`six-system-arena` 是唯一真源，本包只作副本分发。

---

## 0. 前置检查

| 项 | 位置 / 要求 |
|---|---|
| 站点工程（正式） | `E:\Projects\server\app\src\cards\` |
| 站点回滚副本（只读参考） | `D:\Projects\zszm\` |
| 图标宿主 | `E:\Projects\shared\shared-ui\lxh-ui.js`（提供 `window.LXHUI.ICONS`） |
| 类型契约 | `E:\Projects\shared\shared-types\models.d.ts`（`Element` / `AbilitySystem`） |
| 数据 | 本包 `data/*.json`：488 角色 / 488 卡组 / 15 成就 / 六系定义 / 数值模型 |
| 运行时 | 现代浏览器（ES2020+），无第三方依赖 |

就位自检（三条命令全为 `True`）：

```powershell
Test-Path 'E:\Projects\server\app\src\cards\src\game\GameApp.tsx'
Test-Path 'E:\Projects\shared\shared-ui\lxh-ui.js'
python "E:\Projects\New project\six-system-arena\integration\verify\verify_integration.py"
```

---

## 1. 零映射对照表（为什么接入成本极低）

| 站点既有类型 | 取值 | 六系图标 key | 需不需要映射 |
|---|---|---|---|
| `Element` | `'jin' \| 'mu' \| 'shui' \| 'huo' \| 'tu'` | `jin / mu / shui / huo / tu` | 同名，直取 |
| `AbilitySystem` | 含 `'kongjian'` | `kongjian` | 同名，直取 |
| `Card.element` | `Element?`（字段已预留） | — | `<LxhIcon name={card.element} />` |
| `Card.school` | `AbilitySystem?`（字段已预留） | — | `<LxhIcon name={card.school} />` |

结论：运行时脚本加载后，六键自动进入 `window.LXHUI.ICONS`，站内 `LxhIcon` 无需任何改动即能渲染六系图标。

---

## 2. 步骤一 · 复制文件

```powershell
$Arena = 'E:\Projects\New project\six-system-arena'
$Cards = 'E:\Projects\server\app\src\cards'      # 正式站点根；先在副本试装可改为 'D:\Projects\zszm'

# ① 运行时 JS
New-Item -ItemType Directory -Force "$Cards\public\sixsys" | Out-Null
Copy-Item "$Arena\integration\js\*" "$Cards\public\sixsys\" -Force

# ② 静态数据
New-Item -ItemType Directory -Force "$Cards\public\sixsys\data" | Out-Null
Copy-Item "$Arena\integration\data\*" "$Cards\public\sixsys\data\" -Force

# ③ 接入层源码 + 样式
New-Item -ItemType Directory -Force "$Cards\src\game\sixsys" | Out-Null
Copy-Item "$Arena\integration\src\*" "$Cards\src\game\sixsys\" -Force
Copy-Item "$Arena\integration\styles\sixsys-integration.css" "$Cards\src\game\sixsys\" -Force
```

复制后核对：

```powershell
Get-ChildItem "$Cards\public\sixsys" -Recurse -File | Select-Object FullName, Length
```

---

## 3. 步骤二 · 入口引入运行时

在入口 HTML（`index.html`，或 `main.tsx` 挂载的模板）中，**必须排在 `lxh-ui.js` 之后**：

```html
<script src="/shared-ui/lxh-ui.js"></script>            <!-- 既有：提供 LXHUI -->
<script src="/sixsys/six-system-icons.js"></script>     <!-- 新增：注册 jin/mu/shui/huo/tu/kongjian -->
<script src="/sixsys/settlement.js"></script>           <!-- 新增：window.SixSystemSettlement -->
```

> 若站点用打包器，可在 `main.tsx` 顶部等价改为 `import '/sixsys/six-system-icons.js';`。

**验证**：浏览器控制台执行 `window.LXHUI.ICONS['jin']`，返回 SVG 字符串即成功。

---

## 4. 步骤三 · 挂载组件（四处，互相独立，可分别上线）

### 4.1 卡牌 · 胜负结算（推荐首个接入）

在 `GameApp.tsx` 结局区块内（`run.phase === 'victory' | 'defeat'`）：

```tsx
import { SettlementStage } from './sixsys';

{run && (run.phase === 'victory' || run.phase === 'defeat') && (
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
```

- 胜利：罗小黑 + 比丢登场（3s 时间轴），正向反馈文案；
- 失败：小黑安慰表情 + 一键「再来一次」，**不扣资源、不掉进度、不判成就**（`penalty: false`）。

### 4.2 卡牌 · 角色详情六系面板

```tsx
import { SixSystemPanel } from './sixsys';

<SixSystemPanel characterId={1} />
```

### 4.3 卡面六系徽标

复用站点既有 `LxhIcon`，无需改动组件本身：

```tsx
import { LxhIcon } from './LxhIcon';

<LxhIcon name={card.element} />
```

### 4.4 成就解锁条

```tsx
import { AchievementBanner } from './sixsys';

<AchievementBanner achievements={newlyUnlocked} delayMs={3000} />
```

### 4.5 经营 / 模拟系统

- **经营**：`ManagementPanel.tsx` 的 iframe 地址追加 `?sixsys=1`，据点加成按六系维度读取 `six-systems.json`；
- **模拟（灵境生态）**：生态个体详情用 `<LxhIcon name={individual.element} />`，`EcoIndividual.element` 已是 `Element`，同样零映射。

---

## 5. 步骤四 · 官方素材安装（红线）

```powershell
$Arena = 'E:\Projects\New project\six-system-arena'
$Cards = 'E:\Projects\server\app\src\cards'

# 先 DRY-RUN 预览（不落盘）
powershell -ExecutionPolicy Bypass -File "$Arena\integration\verify\install_assets.ps1" `
  -Dest "$Cards\public\sixsys\official"

# 确认无误后加 -Apply 实际复制
powershell -ExecutionPolicy Bypass -File "$Arena\integration\verify\install_assets.ps1" `
  -Dest "$Cards\public\sixsys\official" -Apply
```

| 逻辑 id | 用途 | 落点 |
|---|---|---|
| `luoxiaohei_full` | 胜利 · 小黑登场 | `public/sixsys/official/luoxiaohei_full.jpg` |
| `bidiu` / `bidiu_anim` | 胜利 · 比丢登场 | `.../bidiu.png` / `bidiu.gif` |
| `luoxiaohei_face_01` / `02` | 失败 · 小黑安慰 | `.../luoxiaohei_face_0x.jpg` |

红线（`docs/05`）：

1. **只复制**，不改画、不加滤镜、不做超分放大；
2. 素材缺失不白屏——组件自动回落六系图标 + 文案；
3. **严禁 AI 生图 / 同人图 / 来源不明的网络图**；确需联网采集时必须逐张核验为《罗小黑战记》原作图并在 `docs/05 §5` 登记来源。

---

## 6. 步骤五 · 验证

```powershell
$Arena = 'E:\Projects\New project\six-system-arena'

# ① 集成包自检（文件 / 漂移 / 红线 / 契约 / 数据）
python "$Arena\integration\verify\verify_integration.py"

# ② 运行时冒烟（图标注册 / 胜负契约 / 克制环 / 成就判定）
node "$Arena\integration\verify\smoke_integration.mjs"

# ③ 站点本地运行
cd E:\Projects\server\app\src\cards
npm run dev        # 默认 5173
```

| 检查点 | 期望 |
|---|---|
| 控制台 `window.LXHUI.ICONS['jin']` | 返回 SVG 字符串 |
| 卡面 | 出现六系图标徽标 |
| 打赢一局 | 小黑 + 比丢登场、正向反馈 |
| 打输一局 | 小黑安慰、可一键再来、无资源扣除 |
| 角色详情 | 六维雷达面板正常渲染 |

---

## 7. 回滚

```powershell
$Cards = 'E:\Projects\server\app\src\cards'

# ① 删文件（不损任何数据）
Remove-Item -Recurse -Force "$Cards\public\sixsys", "$Cards\src\game\sixsys"
# ② 或移除入口两行 <script>
# ③ 或 git revert 对应 merge 提交
```

共享图标层如需还原：`python "E:\Projects\New project\six-system-arena\data\scripts\patch_lxh_icons.py" --rollback`。

---

## 8. 常见问题

| 现象 | 原因 | 处置 |
|---|---|---|
| 图标空白 | 运行时脚本未加载，或排在 `lxh-ui.js` 之前 | 调整 `<script>` 顺序；控制台查 `window.LXHUI.ICONS` |
| 素材 404 | 未执行安装脚本 / `-Dest` 写错 | 重跑 `install_assets.ps1 -Apply`，确认 `public/sixsys/official/` |
| 面板不显示 | `characterId` 越界，或数据未拷入 | 确认 `public/sixsys/data/character_stats.json` 存在 |
| 结算不出现 | 挂载点不在结局区块内 | 把 `<SettlementStage>` 放进 `run.phase` 判定块 |
| 样式冲突 | 未引入 CSS | 引入 `sixsys-integration.css`（选择器均带 `sixsys-` 前缀） |

---

## 9. 短分支并行建议

| 分支 | 内容 | 生命周期 |
|---|---|---|
| `feat/sixsys-icon-mount` | 步骤二 + 4.3（图标挂载） | ≤ 1 天 |
| `feat/sixsys-radar-panel` | 4.2（六系雷达面板） | ≤ 1 天 |
| `feat/sixsys-battle-settle` | 4.1 + 4.4（结算 + 成就条） | ≤ 1 天 |

纪律：一支一职、合并即删；`git add` 精确到路径，禁用 `-A`。

---

*《罗小黑战记》非商业同人项目「六系演武」· 素材版权归原作方所有。*
*（内容由AI生成，仅供参考）*
