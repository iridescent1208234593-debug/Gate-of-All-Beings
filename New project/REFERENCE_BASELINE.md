# Iridescently · Local Design Reference Baseline

本目录是 Iridescently 的本地设计研究与实验工作区。

目的不是把这些项目直接拼装进正式网站，也不是要求最终网站模仿其中任何一个项目。

这些仓库分别承担不同的设计研究职责。

正式设计时，应：

1. 先理解 Iridescently 自身内容与现有设计系统。
2. 再按问题读取对应参考项目。
3. 提炼其设计原则、交互模型和实现方法。
4. 最终重新映射到 Iridescently 自己的 token、component、pattern 与 theme。
5. 不要把某一个参考项目的具体视觉皮肤直接复制成全站风格。

---

# 1. 正式项目位置

主要设计目标：

```text
portal\huiguan\design-system
```

这是目前较简单的会馆设计系统，允许进行大幅度重构。

同时必须检查：

```text
shared\shared-ui
```

这是整个 Iridescently 更适合作为长期共享设计系统核心的位置。

未来需要判断：

- 哪些属于全站 Core
- 哪些属于 Huiguan Theme
- 哪些属于通用 Component
- 哪些属于高级 Pattern
- 哪些只应该留在 Lab

不要默认现有结构必须保留。

这是一次允许较大结构调整的设计系统演进任务。

---

# 2. 网站长期设计方向

Iridescently 不是典型企业 SaaS。

主要内容包括：

- 角色 / OC
- 世界观
- 插画与 Gallery
- 内容型页面
- 游戏
- 互动实验
- 编辑器
- 用户创造内容
- 功能型页面

核心视觉方向：

**Emotional + Alive + Iridescent + Editorial + Spatial**

即：

- 有感情
- 有生命感
- 多彩
- 连续
- 有编辑感
- 允许空间体验
- 内容本身优先
- 动效必须与真实状态变化有关

明确避免默认落入：

- Linear / Vercel SaaS Skin
- 硬冷科幻
- A24 式泛文化极简
- 满屏 Bento Grid
- 满屏 Glassmorphism
- 所有页面 WebGL
- 所有页面电影化
- AI 默认“大渐变 + 大圆角 + Inter”
- 为了品牌统一而磨平内容个性

---

# 3. 最重要的全局原则

## Content First

角色、图片、世界观、游戏和真实功能本身就是视觉内容。

不要为了“设计感”不断给内容套卡片、玻璃层和装饰框。

## Natural Ratio First

图片默认尊重原始比例。

不要无脑全部裁切为 1:1、4:3 或 16:9。

## Continuous State

重要状态之间应该尽量表现为：

```text
A transforms into B
```

而不是：

```text
A disappears
transition overlay
B appears
```

## Variable Density

不同页面允许不同信息密度。

阅读、Gallery、Editor、首页和游戏入口不应被同一套 section 模板统治。

## Same Data ≠ Same Presentation

Desktop 与 Mobile 可以共享数据和业务状态，但采用不同表现。

例如：

```text
Desktop Spatial Gallery
Mobile Curated Feed

Desktop Inspector
Mobile Bottom Sheet

Desktop WebGL
Mobile CSS / Canvas / Static fallback
```

---

# 4. AI 设计方法参考

## Garden Skills / web-design-engineer

路径：

```text
New project\skills\garden-skills\skills\web-design-engineer
```

优先阅读：

```text
SKILL.md
references\
```

用途：

**设计工程方法论。**

主要学习：

- Design Read
- Extension / Preserve / Overhaul
- 设计系统先于实现
- Design Direction
- v0
- Critique
- Typography / spacing / radius / shadow / motion 的系统化判断
- style recipes 作为参考坐标

禁止：

- 直接选择某一个 recipe 后把整个 Iridescently 套进去。
- 把 Linear、Aesop、MUJI 等当最终答案。

这些 recipe 是分析坐标，不是模板。

---

# 5. Gallery — Atmosphere

## Atmospheric Depth Gallery

路径：

```text
New project\gallery\codrops-depth-gallery
```

本地 checkpoint：

```text
commit: b91193b
tag: depth-auto-gallery-v1
```

这是经过本地改造后的实验版本。

核心职责：

**Climate / Atmosphere**

重点研究：

- 图片驱动环境色
- 自动 palette
- mood interpolation
- Background shader
- blob
- grain
- velocity response
- 图片切换时 atmosphere 连续变化
- texture lifecycle
- palette lifecycle
- dynamic gallery discovery

这是目前 Gallery 最重要的视觉参考之一。

特别重要：

最终应该学习：

```text
image
→ palette
→ atmosphere
→ spatial mood
```

禁止：

- 把 Z 轴穿图本身视为最终导航方案
- 把 Depth 的具体布局直接搬到所有 Gallery
- 把高成本 shader 扩散到普通功能页面

---

# 6. Gallery — Spatial Path

## Curve Gallery

路径：

```text
New project\gallery\curve-gallery
```

本地 checkpoint：

```text
branch: sol-visual-phase
commit: a3e5d8e
tag: curve-real-gallery-v1
```

基础 checkpoint：

```text
d509e40
tag: astra-foundation-v1
```

核心职责：

**Spatial Path / Camera / Curved Navigation**

重点研究：

- 曲线路径
- camera orientation
- spatial arrangement
- mood fields
- 空间中的作品分布
- 路径式浏览

注意：

当前实验存在已知视觉问题：

- camera 可能穿过图片
- atmosphere 不如 Depth 丰富
- spatial composition 仍需改进

因此：

只把它当空间路径研究素材。

不要把当前视觉结果当最终设计。

---

# 7. Gallery — Ceremonial Path

## Infinite GSAP Gallery

路径：

```text
New project\gallery\infinite-gsap-gallery
```

核心职责：

**Path / Ceremonial Browsing**

重点研究：

- 不规则但有秩序的 Gallery
- 图片之间的呼吸距离
- 惯性运动
- Gallery → Detail continuity
- GSAP Flip
- 正面观看图片
- 主线浏览的仪式感

关键词：

**神性 / 克制 / 展陈 / 路径**

禁止：

- 加太多 shader
- 加太多粒子
- 加太多旋转
- 把仪式感做成炫技 portfolio

这个参考的价值来自克制。

---

# 8. Gallery — Story

## Scroll-Revealed WebGL Gallery

路径：

```text
New project\gallery\scroll-revealed-webgl
```

核心职责：

**Story / Chapter Transition**

重点研究：

- gallery image → fullscreen
- shader reveal
- chapter progression
- detail transition
- 图像如何进入叙事

适合未来：

- 世界观章节
- OC 故事
- 系列专题
- 纪念页
- 关键事件
- Project Story

禁止：

把它作为所有 Gallery 的基础浏览模型。

---

# 9. Signature Motion — Dot Dissolve

## dotmatter

路径：

```text
New project\motion\dotmatter
```

优先阅读：

```text
llms.txt
packages\core
packages\shaders
packages\react
```

核心职责：

**Dither / Halftone / Dot-based Media Transformation**

目标不是直接集成 dotmatter UI。

重点研究如何形成 Iridescently 自己的：

**Dot Dissolve**

目标视觉逻辑：

```text
Surface A
↓
Rasterize
↓
Halftone
↓
dot radius decreases
spacing increases
↓
sparse colored dots
↓
B dots emerge
↓
dot radius increases
spacing decreases
↓
Surface B
```

核心感觉：

**A 不是消失，A 变成了 B。**

未来可形成不同模块变体：

```text
Gallery → 图片原色
OC → 角色主题色
World → atmosphere 色
Games → 可加入轻物理
Article → 极轻量 dither
```

只适用于重要 media / transition。

禁止：

- 所有按钮点阵化
- 所有页面 dissolve
- 整个 DOM 长期跑 shader

---

# 10. Normal UI Motion

## Motion Primitives

路径：

```text
New project\motion\motion-primitives
```

核心职责：

**普通 UI Micro-interaction**

重点研究：

- Accordion
- Tabs
- Dialog
- Hover
- Text animation
- Layout transition
- Carousel
- Animated state
- Micro-interaction

原则：

普通功能 UI 应优先使用轻量 motion。

不要因为 Iridescently 有 WebGL 页面，就把普通设置页、表单和列表也做成 GPU 实验。

---

# 11. Real Layout Transformation

## Scroll Based Layout Animations

路径：

```text
New project\motion\scroll-layout-animations
```

核心职责：

**Layout Transformation**

重点研究：

- ScrollTrigger
- Flip
- 真实 DOM layout 状态切换
- 同一内容如何连续改变布局

这符合 Iridescently 的核心偏好：

> 一个东西真的在变化，而不是盖一层动画假装变化。

重点学习状态映射和 transition architecture。

不要直接复制 demo 视觉。

---

# 12. Gallery 五个长期概念

未来 Gallery 参考统一按以下模型判断：

```text
Climate
Geography
Path
Artifact
Story
```

当前本地项目覆盖：

```text
Atmospheric Depth
= Climate

Curve
= Path / Spatial research

Infinite GSAP
= Curated Path

Scroll-Revealed
= Story
```

目前仍缺少特别成熟的：

```text
Geography
Artifact
```

但不是当前必须解决的问题。

未来再针对缺口补充参考。

---

# 13. 功能型页面设计原则

目前没有必要 clone Linear、Notion、Figma、GitHub 或 Webflow 的非官方源码。

它们作为产品行为参考：

## Linear

学习：

**真实功能本身就是视觉。**

Interactive Demo > Video Demo > Screenshot

不要学习 SaaS 视觉皮肤。

## Notion

学习：

**Content Continuity**

```text
List
→ Peek
→ Detail
```

以及：

Desktop / Mobile 可以重新组合布局。

## Webflow

学习：

**Creation Lifecycle**

```text
Create
Edit
Autosave
Preview
Publish
```

未来应逐渐形成：

- Draft
- Saved
- Private
- Public
- Published
- Scheduled

## Figma

学习：

**Contextual Editor**

选中什么，显示什么。

功能增加不应该导致所有控件同时出现。

## GitHub

学习：

**Functional Discipline**

- serializable filters
- URL state
- dense list
- status
- bulk action
- mobile degradation

视觉不参考。

---

# 14. Typography 参考原则

## It’s Nice That

负责：

**Personality / Emotional Editorial**

学习：

- 内容特异性的版式
- 海报感
- 图文节奏
- Natural Ratio
- 页面高潮与安静阶段

## M+

负责：

**Chinese Reading Safety Net**

学习：

- 中文长文列宽
- 中英混排
- caption
- metadata
- section hierarchy

当实验设计损害中文阅读时，优先回到这一类成熟排版原则。

## Aesop

负责：

**Quiet Mode**

适用于：

- 人物独白
- 回忆
- 文化内容
- 安静章节

不要奢侈品牌化全站。

## Tai Kwun

负责：

**Event / Theatre**

适用于：

- Chapter Opening
- Trailer
- Launch
- 周年
- 特殊企划

低频使用。

---

# 15. 整站参考角色

## Playdate

负责：

**不同模块如何仍然拥有同一个世界的生命力。**

学习融合方式。

不要学习具体黄黑皮肤。

## Are.na

负责：

**Collection / Archive / 内容收纳。**

框架退后，内容自己说话。

## It’s Nice That

负责：

**大量图文内容如何保持节奏和人格。**

这三个比任何单一“视觉风格”更接近 Iridescently 的整站基线。

---

# 16. 正式 Design System 的目标结构

当前不要机械照此建立文件，而应先审计现有代码后决定。

概念上建议未来区分：

```text
Core
Theme
Component
Pattern
Lab
```

## Core

全站长期稳定：

- typography scale
- spacing
- radius
- elevation
- motion duration
- easing
- layout primitive
- content width
- responsive strategy
- image behavior
- focus
- hover
- reduced motion

## Theme

允许不同区域有不同世界：

- Huiguan
- Iridescent Main
- OC
- Games
- Event
- Character-specific

## Component

稳定、功能明确的 UI：

- Button
- Input
- Select
- Modal
- Drawer
- Tabs
- Card
- Table
- Toast
- Navigation
- Form controls

## Pattern

更高级的组合：

- Dot Dissolve
- Atmospheric Media
- Gallery
- Detail Peek
- Contextual Inspector
- Chapter Opening
- Live Product Preview
- Collection
- Publish Flow

## Lab

尚未成熟的：

- shader
- WebGL
- transition
- experimental layout
- spatial interaction

只有多次验证成功后，Lab 才能升级为 Pattern。

---

# 17. 对现有 Huiguan Design System 的态度

现有：

```text
portal\huiguan\design-system
```

结构较简单。

本次允许：

- 大幅度调整 token
- 重构组件层级
- 重新组织主题
- 新增必要组件
- 废弃明显限制演进的旧规则
- 把真正全局的内容迁向 shared-ui
- 保留有价值的中国古色体系

不要被现有以下规则机械限制：

> 只能使用现有 qc- 组件，不允许新增组件。

如果新的组件或 Pattern 有明确重复价值，可以设计和新增。

但新增后必须进入正式规范，而不是成为页面级一次性 CSS。

---

# 18. Astra / 高能力模型阅读顺序

执行全站设计审计时建议：

### 第一阶段：理解目标

阅读：

```text
New project\REFERENCE_BASELINE.md
```

### 第二阶段：理解现有系统

阅读：

```text
portal\huiguan\design-system
shared\shared-ui
```

并检查主站、会馆、OC 当前实际使用方式。

### 第三阶段：学习设计方法

阅读：

```text
New project\skills\garden-skills\skills\web-design-engineer\SKILL.md
```

按需读取其 references。

不要一次把所有 style recipes 当上下文。

### 第四阶段：按问题读取源码参考

需要 atmosphere：

```text
codrops-depth-gallery
```

需要 spatial navigation：

```text
curve-gallery
```

需要 ceremonial Gallery：

```text
infinite-gsap-gallery
```

需要 story transition：

```text
scroll-revealed-webgl
```

需要 Dot Dissolve：

```text
dotmatter
```

需要普通 UI motion：

```text
motion-primitives
```

需要 layout morph：

```text
scroll-layout-animations
```

不要无目的扫描所有仓库全部文件。

---

# 19. 最重要的执行约束

这些参考项目默认视为：

**READ-ONLY DESIGN REFERENCES**

除非任务明确要求修改实验仓库，否则不要改动它们。

正式设计实现应该进入 Iridescently 正式项目。

不要：

- 把参考仓库 merge 进正式项目
- 大量复制其代码结构
- 把多个 demo 粘在一起
- 因为有现成 shader 就强行使用
- 因为参考项目用了 React 就要求现有页面全部 React 化
- 因为参考项目视觉漂亮就改变产品信息架构

参考的是：

- 原理
- pattern
- 状态模型
- motion vocabulary
- composition
- resource architecture

而不是复制网站。

如果要直接复用源码片段或第三方依赖，需要先检查相应项目许可证和依赖许可。

---

# 20. 最终判断标准

任何新的视觉或交互方案都必须回答：

1. 它改善了内容表达吗？
2. 它让状态关系更清楚了吗？
3. 它增强了 Iridescently 的独特性吗？
4. 它可以在设计系统里解释吗？
5. 移动端如何处理？
6. reduced-motion 如何处理？
7. 页面性能是否合理？
8. 如果删除这个效果，内容会不会反而更好？

如果第 8 项答案是：

**会。**

则优先删除该效果。

---

# 当前状态

本地设计研究环境已建立。

下一步不是继续下载参考仓库。

下一阶段任务：

**审计 Iridescently 当前 Design System，并设计 Design System v2 的结构与迁移方案。**

第一轮应先分析和提出方案，不要立即大规模改代码。