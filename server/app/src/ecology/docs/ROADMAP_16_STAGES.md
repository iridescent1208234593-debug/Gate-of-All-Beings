---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_968ef6bcabb111f188ac525400dcc5b3
    ReservedCode1: aBFmBDtqEWPXPpkT4UtIYdz0jVJVr6jWIqr+uppQlAF+tk+KYL/qjdvUIX2AC/3kamCURnY215n6m56wAYBzDGakd7uWJdbeE+mAohh26IbvKhj0zlZ3RR0Gv7MMaThhCqFKfhdrcUiexe5pdy/rrwImHXr/vbXHZe5FwlfUbaddVHGEQLSH/QC11cg=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_968ef6bcabb111f188ac525400dcc5b3
    ReservedCode2: aBFmBDtqEWPXPpkT4UtIYdz0jVJVr6jWIqr+uppQlAF+tk+KYL/qjdvUIX2AC/3kamCURnY215n6m56wAYBzDGakd7uWJdbeE+mAohh26IbvKhj0zlZ3RR0Gv7MMaThhCqFKfhdrcUiexe5pdy/rrwImHXr/vbXHZe5FwlfUbaddVHGEQLSH/QC11cg=
---

# 生态进化新坑 · 16 阶段自动开发任务书

> 目标：从零构建一款"阶段式进化"Web 游戏（纯 JS ES Modules + three.js + Vite + 单向数据流），对标 Spore（五幕进化）与 Thrive（七阶段进化），参考已实测可跑的 EcoPlanet3D / LifeEngine / aeon / planet-eden 四个开源项目。
> 节奏：共 16 个阶段，每阶段约 30 分钟工作量，每 30 分钟由自动任务推进一个阶段（interval 循环任务）。
> 约定：所有产物落在 `server\app\src\ecology`。每阶段完成后，自动任务把完成记录写入 `.progress.json`。

## 进度文件机制

- 进度文件：`server\app\src\ecology\.progress.json`
- 结构：`{"done": ["stage-01", "stage-03", ...], "last": "stage-XX", "summary": {}}`
- 执行规则：读取本文件，找到序号最小的未完成阶段执行；完成后立即更新文件并汇报。已全部完成则只汇报，不重复执行。

## 技术约束（每一阶段必须遵守）

1. 纯 JS ES Modules + Canvas2D/WebGL（three.js）+ Vite，**禁止引入框架**（React/Vue 等）。
2. 单向数据流：Action → reducer → GameState → 渲染，状态不可变更新。
3. **禁止硬编码色值**：颜色统一走调色板常量或主题 token（`src/ui/theme.js` 之类）。
4. 每阶段结束前必须本地验证：`npm run dev` 可启动无报错，且改动功能肉眼可验证。
5. 参考项目源码位置：EcoPlanet3D / LifeEngine / aeon / planet-eden 四个项目的本地克隆位于主工作区的 temp 参考目录（路径以 `.refs_path.json` 记录，找不到时只按本任务书的机制描述自行实现，不要阻塞）。
6. 每阶段都写"最小可玩增量"，不追求完整，30 分钟能交付一个可看的闭环。

## 阶段清单（16 阶段 = 五幕）

### 第一幕：细胞时代（对标 Thrive Microbe / Spore 细胞阶段 / LifeEngine 细胞机制）

#### Stage 01 骨架与细胞场（30 min）
- 对标：Thrive `microbe_stage` 初始场景 + EcoPlanet3D Vite 工程
- 目标：在 `server\app\src\ecology` 初始化 Vite + three.js + ESM 工程；场景含地面网格、OrbitControls 摄像机、一组随机漂移的细胞球体；GameState + tick 循环 + 单向数据流已可跑。
- 实现要点：`src/main.js` 入口；`src/core/state.js`（createInitialState / reducer / tick）；`src/core/renderer.js`（three.js 场景渲染 GameState）；`src/core/actions.js` 定义动作；`index.html`。
- 验收：`npm run dev` 无报错，页面可见细胞在场内缓慢漂移，控制台无异常。
- 参考：EcoPlanet3D 的 Vite 结构。

#### Stage 02 细胞代谢与进食（30 min）
- 对标：Thrive 的化合物/能量系统（Glucose 等）、LifeEngine 细胞能量消耗
- 目标：场景放置食物粒子（能量团）；细胞靠近后自动吸收并增加能量；细胞持续消耗能量，能量耗尽死亡消失。
- 实现要点：GameState 增加 `entities[]`（含 energy）；食物粒子池；碰撞吸收判定（距离阈值）；死亡从状态移除。
- 验收：食物会随时间被吸走，细胞饿死可见，能量 UI（顶部简单数字）存在。

#### Stage 03 基因数据模型与随机变异（30 min）
- 对标：Thrive Microbe DNA / 基因编辑器数据结构
- 目标：每个细胞携带基因对象 `{speed, size, perception, metabolism, color}`；新建细胞时父基因小幅随机变异；基因影响移动速度、感知半径、能耗。
- 实现要点：`src/core/genome.js`（默认基因 / 变异函数 mutate(genome, rate)）；reducer 在分裂时生成子代基因。
- 验收：细胞移动速度与感知行为肉眼可见有差异。

#### Stage 04 分裂繁殖与基础自然选择（30 min）
- 对标：Thrive Auto-Evo（后台世代演化）、Spore 细胞阶段繁殖
- 目标：能量达到阈值触发分裂（一分为二，子代带变异基因）；种群上限（压力淘汰）；每 N 秒统计存活者基因倾向（简单 auto-evo：记录存活细胞平均基因）。
- 实现要点：reducer 处理 SPLIT；population cap 移除最弱；`src/core/autoEvo.js` 输出每代统计。
- 验收：种群稳定波动，顶部或控制台能看到"世代 n / 平均速度上升"之类演化数据。

#### Stage 05 3D 外观基因化（30 min）
- 对标：Thrive Microbe 编辑器外观预览
- 目标：细胞外观随基因渲染：体型（scale）、颜色（基因色 → 调色板）、感知圈（可选环）。量大时用 InstancedMesh 保证性能。
- 实现要点：renderer 根据 genome 构造材质与几何参数；theme token 提供色板。
- 验收：多个细胞颜色/大小明显不同，帧率可接受。

#### Stage 06 细胞编辑器 MVP（30 min）
- 对标：Thrive Microbe Editor（消费进化点改基因，按确认生效）
- 目标：暂停时弹出面板：显示当前选中细胞基因，可上调/下调 3 个属性（速度/感知/体型），消耗"进化点"；确认后更新该细胞并给场景加入少量新细胞展示。
- 实现要点：UI 用原生 DOM 覆盖层（不是框架），Action 走 PAUSE / OPEN_EDITOR / APPLY_GENOME。
- 验收：能选中细胞改基因并看到变化，进化点可被扣减。

### 第二幕：多细胞时代（对标 Thrive Multicellular / The Life Engine 模块细胞 / aeon 细胞块）

#### Stage 07 多细胞模块模型（30 min）
- 对标：Thrive Multicellular（细胞粘合成有机体）、The Life Engine 的体细胞/鞭毛/口器
- 目标：引入"有机体 organism"概念：由若干细胞模块组成，模块类型有 `body`（体细胞）/`flagellum`（鞭毛，+速度）/`mouth`（口器，+进食）/`chloroplast`（叶绿体，+被动产能）；有机体作为一个整体存在与游动。
- 实现要点：GameState.organisms[]；模块列表驱动数值合成；渲染沿用细胞体拼成团。
- 验收：可 spawn 一个由多模块组成的有机体，移动与进食速度体现模块加成。

#### Stage 08 有机体行为（30 min）
- 对标：EcoPlanet3D 生物寻路 + LifeEngine 行为
- 目标：有机体自主行为：主动游向最近食物；若体型差距大则躲避；叶绿体多的个体倾向停留光合；行为权值由模块决定。
- 实现要点：`src/core/behaviors.js` 每 tick 决策（感知 → 目标 → 移动）；行动成本扣能量。
- 验收：有机体群会聚向食物堆、被大个体追时逃散。

#### Stage 09 生成编辑器（30 min）
- 对标：Thrive Multicellular Editor（网格上拼接细胞）
- 目标：暂停面板切换"组装模式"：网格显示当前有机体细胞布局，点击空位添加细胞模块（消耗能量/进化点），可删除已有模块。
- 实现要点：编辑器状态机（选择类型 → 点击格子）；预览合成效果（速度/体积/耗能预估）。
- 验收：能在编辑器里拼出一个可游动的有机体。

#### Stage 10 世代演化与体型趋势（30 min）
- 对标：Thrive Auto-Evo 的分步执行（Gathering info → Stepping → Ended）、Spore 由细胞到生物的体型跃迁
- 目标：有机体也能繁殖并变异模块布局；环境中引入"食物稀缺压力"使大个体（模块多）在富营养区占优、小个体在贫瘠区占优；记录世代体型趋势。
- 实现要点：auto-evo 对 organisms 每 10 秒结算一次种群存活比例并调整 spawn 概率；`src/core/autoEvo.js` 扩展为模块布局统计。
- 验收：长时间运行能看到环境分异趋势数据（图或文本）。

### 第三幕：生态时代（对标 EcoPlanet3D 经营 × Thrive 环境补丁）

#### Stage 11 网格环境与食物链（30 min）
- 对标：EcoPlanet3D 的地图格经营、Spore 生物阶段生态
- 目标：2D 网格地形（草地/水域/沙地），草地自动产出植物（生产者），草食有机体吃植物，肉食有机体吃草食；生态金字塔雏形。
- 实现要点：`src/world/map.js`（瓦片类型）；植物生长 tick；捕食判定（肉食模块 + 追击行为）。
- 验收：三类实体数量能形成动态平衡（肉食不会立刻饿死或爆炸繁殖）。

#### Stage 12 生态经营面板与昼夜（30 min）
- 对标：EcoPlanet3D 的资源/温度面板、Thrive Patches 的昼夜
- 目标：HUD 面板：总能量/种群数/多样性指数（简化 Simpson）/地图温度；时间流速 1x/2x/3x；昼夜循环影响叶绿体产能与视野。
- 实现要点：`src/ui/hud.js` DOM 面板；timeScale 状态；光照随昼夜变化。
- 验收：切换倍速与昼夜均生效，面板数据随 tick 更新。

#### Stage 13 环境干预（30 min）
- 对标：Thrive Patches（调整环境条件影响演化压力）、Spore 生物阶段手动干预感
- 目标：玩家可对地图施加环境影响：播种植物、排水/注水改瓦片、调温度；环境变化逐渐改变种群构成。
- 实现要点：鼠标点击地面弹出干预菜单；Action 改环境；auto-evo 参数读环境。
- 验收：调高温度后，冷适应（多体细胞保温型）种群占比可观测变化。

### 第四幕：部落/觉醒（对标 Thrive Awakening + aeon 群体）

#### Stage 14 简易神经网络个体（30 min）
- 对标：Thrive Awakening 个体智能、aeon 的 agent 决策
- 目标：部分个体带极简神经网络（感知数组→全连接→动作：采集/移动/跟随）；无神经个体仍走老行为；网络参数随繁殖变异。
- 实现要点：`src/core/nn.js`（固定拓扑 [6,4,4] 前向传播）；行为选择器优先走 NN。
- 验收：NN 个体表现出比普通个体更"聪明"的觅食倾向（可对比统计）。

#### Stage 15 群体与领地（30 min）
- 对标：Thrive Awakening Strategy Mode（群体阵型/命令）
- 目标：同基因簇个体形成群体：显示领地圈与群体标记；玩家可点击群体下达"移动/采集/繁殖禁令"指令；群体共享能量。
- 实现要点：`src/core/tribe.js`（成员列表、领地、共享能量池、指令队列）；渲染群体标识。
- 验收：群体成员会跟随指令移动，能量共享可见。

### 第五幕：文明（对标 Thrive Society/Industrial + aeon 文明经营 + planet-eden）

#### Stage 16 文明最小闭环（30 min）
- 对标：Thrive Society Stage 的聚落研究机制、aeon 的采集/升级
- 目标：从部落发展出聚落：资源点（水/食物/矿物三色点）→ 单位自动采集 → 资源入库；研究点数解锁两级科技（火=照明/烹饪加成、工具=采集效率）；HUD 显示文明进度条；到达"建城"节点弹出胜利资料页（后续太空/上帝阶段内容以文本预告收尾）。
- 实现要点：`src/core/civilization.js`；科技树常量；资源 HUD；通关状态。
- 验收：从自动演化到文明建城完整链路可 5 分钟内跑通，可截图汇报。

## 关于对标的说明（Thrive 解析结论已并入各阶段）

- Thrive 官方七阶段：Microbe → Multicellular → Awakening → Society → Industrial → Space → Ascension；本 16 阶段压缩为五幕（细胞→多细胞→生态→觉醒→文明），把 Industrial/Space/Ascension 留作 Stage 16 的"后续预告"，避免 30 分钟粒度撑爆。
- Thrive 可借鉴的工程机制：阶段切换器（stage starter，本作用 act/stage 状态机）、Auto-Evo 后台分步结算（本作每 N tick 结算，不卡主循环）、Microbe/Organism 编辑器（本作 DOM 覆盖层 + GameState 校验）。
- EcoPlanet3D：数值经营与地图网格（Stage 11~13 直接采用思路）；LifeEngine：模块化细胞（Stage 07~09）；aeon：agent 与文明（Stage 14~16）；planet-eden：视觉与生态展示（全局风格参考）。

## 自动任务使用说明

- 调度：一条 interval 循环任务，每 30 分钟触发一次，读取 `.progress.json` 推进下一未完成阶段。
- 阶段执行者视角：每次触发 = 只看本任务书中当前阶段的"目标/实现要点/验收"，把该阶段做成真实可运行的代码，更新进度，简短汇报。
- 16 阶段全部完成后：汇报"16 阶段已全部完成"，等用户决定是否删除循环任务，**不要重复执行已完成阶段**。
*（内容由AI生成，仅供参考）*
