# 贡献指南

感谢你参与《众生之门》的开发。本文档面向团队成员与新加入的协作者，涵盖从报告问题、提交代码到合并的完整流程与规范；为了不让任何人的努力白费，请先花一分钟读完本文，无论你是人类，大肥鱼，还是硅基生命！

> **重要**：本项目是团队协作的私有生产工作区，官方仓库为 [iridescent1208234593-debug/Gate-of-All-Beings](https://github.com/iridescent1208234593-debug/Gate-of-All-Beings)。**所有贡献请一律通过 GitHub 提交**。合并 PR 不等于部署——生产变更（香港生产、Cloudflare、DNS、Tunnel、OAuth 登记）需负责人显式授权。

---

## 目录

1. [项目概览](#项目概览)
2. [环境搭建](#环境搭建)
3. [如何报告问题](#如何报告问题)
4. [如何提交代码](#如何提交代码)
5. [分支策略](#分支策略)
6. [提交信息规范](#提交信息规范)
7. [代码规范](#代码规范)
8. [测试要求](#测试要求)
9. [代码审查流程](#代码审查流程)
10. [行为准则](#行为准则)

---

## 项目概览

《众生之门》不是一个单一游戏，而是一个多站点工作区：三个站点 + 八个游戏模块，共用一套账户与存档边界、一条不可变发布流水线、三个批准根域。

技术栈：Node 22 · Python 3.12 · React + Vite · 原生 JS + Canvas · Three.js · WebGPU · Next.js（仅 activation-core）。

### 架构分层

```
apps/       站点与游戏模块：www huiguan oc cards management ecology juling aeon slay softie world-map shell
services/   统一入口与平台服务：portal_server.py、账户、会话、存储契约、测试
packages/   跨站共享源码：shared-ui / shared-types / shared-data / shared-session / site-domains
tools/      构建、发布、本机运行、域名、回归检查
infra/      入口生成物与探针
docs/       构建发布文档与维护索引
```

> 新增共享能力优先落到 `packages/`；只有本模块使用的视觉与状态留在 `apps/<模块>/` 内。

---

## 环境搭建

### 环境要求

| 依赖 | 版本要求 | 来源 |
| --- | --- | --- |
| Node.js | 22 | `.nvmrc` |
| Python | 3.12 | `.python-version` |
| Git | ≥ 2.30 | — |

### 本地开发

```powershell
# 克隆仓库
git clone https://github.com/iridescent1208234593-debug/Gate-of-All-Beings.git
cd Gate-of-All-Beings

# 安装根依赖
npm ci

# 需要构建哪个模块，就装哪个模块的依赖
npm ci --prefix apps/cards
```

Windows 用户使用 PowerShell。仓库同时被 Linux CI 使用，脚本不要写死盘符或反斜杠路径。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run build:modules` | 构建八个模块候选 |
| `npm run build:site` | 站点候选 |
| `npm run build:homepage` | 首页候选 |
| `npm run release:seal` | 封存不可变 Release |
| `npm run check:world-map` | 世界地图模块单独检查 |
| `python services/platform/tests/verify_portal.py` | 门户路由、Host 与 Origin 策略检查 |
| `python tools/checks/regression.py --full` | 全量回归，只用临时 test 存储 |
| `python tools/checks/local-smoke.py` | 本机运行时起来后的只读冒烟 |

---

## 如何报告问题

### 提交前请确认

1. 搜索是否已有相同或相近的 issue，避免重复
2. 确认问题可稳定复现，而非一次性环境问题

### 问题描述模板

- **标题**：一句话概括问题
- **位置**：站点域名与页面路径，或仓库内的模块路径
- **环境**：浏览器及版本、操作系统、屏幕尺寸
- **复现步骤**：可复现的最小操作路径
- **预期行为**：应当发生什么
- **实际行为**：实际发生了什么，附报错文本
- **附加材料**：截图、控制台报错、相关日志片段

> 提交日志前请隐去账号、密钥与个人数据。

---

## 如何提交代码

### 标准流程

1. **从最新 `master` 切出分支**（命名见[分支策略](#分支策略)）
2. **提交改动**，提交信息遵循[提交信息规范](#提交信息规范)
3. **在本地 CLI 跑完检查与测试**，确认通过后再推送
4. **推送到远端并创建 Pull Request**，目标分支为 `master`
5. 等待审查，根据反馈修改后重新推送
6. 由维护者审查通过后合并

### 提交前检查清单

- [ ] `python services/platform/tests/verify_portal.py` 通过
- [ ] 受影响模块的测试通过
- [ ] `npm run build:modules` 通过
- [ ] 改动涉及共享包或门户路由时，`python tools/checks/regression.py --full` 通过
- [ ] `git status` 中没有数据、密钥、上传或构建产物
- [ ] 以精确路径暂存，未使用 `git add -A`
- [ ] 新增逻辑已补充对应测试
- [ ] 未引入不必要的新依赖

> **提 PR 之前必须自己跑完这些命令，并在 PR 中附上实际执行的命令与结果。** 不能只说"测过了"，也不能把跑不了当成通过。

---

## 分支策略

### 分支命名

| 类型 | 前缀 | 示例 |
| --- | --- | --- |
| 新功能 | `feat/` | `feat/cards-return-summary` |
| 缺陷修复 | `fix/` | `fix/huiguan-concurrent-write` |
| 重构 | `refactor/` | `refactor/split-tools-by-purpose` |
| 文档 | `docs/` | `docs/readme-restructure` |
| 测试 | `test/` | `test/host-policy` |
| 基础设施 | `infra/` | `infra/three-root-ingress` |
| 杂项 | `chore/` | `chore/governance-baseline` |

### 分支原则

- **禁止**直接在 `master` 上开发与提交
- 一个分支 / 一个 PR 只做一件事，保持改动聚焦
- 合并前确保分支基于最新的 `master`
- **禁止**强推、改写已共享的分支历史
- 协作者的分支在评审之前不合并、不删除、不改写

> `docs/development/BRANCH_STRATEGY.md` 中记录的 trunk 名称是当时的规划，实际合并入口以 `master` 为准。

---

## 提交信息规范

使用 Conventional Commits 风格，格式为 `type(scope): 简短描述`。`scope` 写模块或目录名。

### 类型

| 类型 | 用途 |
| --- | --- |
| `feat:` | 新功能 |
| `fix:` | 缺陷修复 |
| `refactor:` | 重构，不改外部行为 |
| `docs:` | 文档改动 |
| `test:` | 测试相关 |
| `style:` | 样式 / 格式 |
| `chore:` | 构建、工具链、依赖等杂项 |
| `perf:` | 性能优化 |

### 示例

```
feat(cards): 出行归来展示三项变化与下一次选项
fix(huiguan): 并发写入时保留对方修改
docs(readme): 重构项目门面并补充路线图
refactor: split scripts/ into tools/ by purpose
```

> 描述用简洁中文，一般 50 字以内；正文说明动机与影响范围，而不是复述 diff。

---

## 代码规范

### 通用

- 文件命名：React 组件用大驼峰（`ModeHall.tsx`），工具与脚本用小驼峰或短横线
- 文本文件统一 UTF-8；中文标点与文案跟随所在目录的既有写法
- 注释说明"为什么"，不复述代码
- 不引入不必要的新依赖；引入需在 PR 中说明理由

### 架构约束

- 优先复用 `packages/shared-ui`、`packages/shared-session`、`packages/shared-types`、`packages/shared-data`；只有出现第二个稳定消费者时，才把模块内实现提升为共享包
- 游戏模块挂载在统一壳里，必须实现 `window.__iridescentlyDispose`；改生命周期时要验证重复挂载与卸载后监听器、RAF、worker、定时器都被释放
- 存储路径必须来自 `IRIDESCENTLY_STORAGE_ROOT` / `IRIDESCENTLY_ENVIRONMENT`；代码不得把源码树当作数据根
- 不得硬编码域名与端口，统一走 `packages/site-domains` 与门户配置
- 改动颜色时以保存的 HEX 为真值，界面派生色显式计算，不用全局滤镜

### 数据与素材

- `data/`、`assets/`、`cache/`、`releases/`、`backups/`、数据库、上传、备份、密钥、日志一律不提交
- 罗小黑 IP 相关图片、音乐、原作资料仅在本项目私有范围内使用，不得外传、不得引入公开仓库
- 新增素材需说明来源与授权状态

---

## 测试要求

### 基本原则

- 新增或修改逻辑必须有对应测试；修复 bug 时先补能复现该 bug 的测试
- 测试必须使用临时 `IRIDESCENTLY_STORAGE_ROOT` 与 `IRIDESCENTLY_ENVIRONMENT=test`，绝不指向生产库
- 不执行 `git clean -fdx`；未跟踪文件可能是用户数据或原件
- 跳过的检查要写明原因，不能把跑不了当成通过

### 运行方式

```powershell
# 门户路由与安全策略
python services/platform/tests/verify_portal.py

# 受影响模块自己的测试
npm test --prefix apps/cards

# 构建候选
npm run build:modules

# 全量回归，只用临时 test 存储
python tools/checks/regression.py --full --modules <candidate>/modules
```

### 覆盖范围参考

- 门户：Host 白名单、跨根域 Origin、未知 Host 拒绝、静态文件敏感路径拦截
- 存储：存储根解析、迁移校验、就绪标记缺失时拒绝启动
- 账户：SSO 会话、邮箱绑定、限流与找回流程
- 卡牌：出行结算、照料与默契、封灵条件、模式存档隔离
- 经营：远征派遣与资源结算
- 模块生命周期：重复挂载 / 卸载后的资源释放

---

## 代码审查流程

1. **自审**：提交前按[检查清单](#提交前检查清单)自查，并在本地跑完命令
2. **CI 校验**：每条推送的分支跑 `regression`，PR 再跑 `merge-gate`（针对合并结果），未通过前不可合并
3. **团队审查**：所有代码需经至少一位维护者审查
4. **修改**：根据反馈更新并重新推送，逐条回应评论
5. **合并**：全部通过后由维护者合并进 `master`

> 推送成功不等于部署成功。发布是另一条需要显式授权的流程，见 [发布流程](docs/release-workflow.md)。

---

## 行为准则

本项目由团队共同维护，协作遵循 GitHub 社区准则：

- 友善沟通，尊重每一位贡献者
- 建设性反馈，对事不对人
- 不接受任何形式的骚扰、歧视或人身攻击
- 拒绝恶意 / 破坏性提交，包括垃圾代码、后门、隐藏脚本

维护者有权拒绝违反上述准则的提交与评论。
