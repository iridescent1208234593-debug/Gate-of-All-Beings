---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_2e772ff3c0ee11f1884b525400cd780f
    ReservedCode1: Z+IFK+rhmAj8GcKJZpe9fTy/zj5opxaV0vI1TBk/IwozDleSzJUww5JuUTAtbsnt5kCzlnLwje/EU99+cFcsHzj0ij6cq5z3bmWagOuck5dU0VOM82G/gXVJy6JQ/yN4ukizvb7fXUEQxhTHQSogxe/XmEVtAhSs45VcDcAtgdg90tXapMHKEv675Wo=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_2e772ff3c0ee11f1884b525400cd780f
    ReservedCode2: Z+IFK+rhmAj8GcKJZpe9fTy/zj5opxaV0vI1TBk/IwozDleSzJUww5JuUTAtbsnt5kCzlnLwje/EU99+cFcsHzj0ij6cq5z3bmWagOuck5dU0VOM82G/gXVJy6JQ/yN4ukizvb7fXUEQxhTHQSogxe/XmEVtAhSs45VcDcAtgdg90tXapMHKEv675Wo=
---

# BRANCHING · 短 git 分支策略

> 目标：分支**生命周期短、命名可读、合并冲突小**；所有新建内容限定在 `E:\Projects\New project\six-system-arena\` 内。

---

## 1. 命名规范：`feat/sixsys-<topic>`

| 前缀 | 用途 | 示例 |
| --- | --- | --- |
| `feat/sixsys-` | 新功能 | `feat/sixsys-icons`、`feat/sixsys-stats`、`feat/sixsys-battle` |
| `fix/sixsys-` | 缺陷修复 | `fix/sixsys-element-map` |
| `docs/sixsys-` | 纯文档 | `docs/sixsys-battle-rules` |
| `chore/sixsys-` | 构建 / 杂项 | `chore/sixsys-automation` |

**topic 命名要求**：小写、短横线分隔、≤ 3 个词（如 `stats-model`、`achievement-collect`）。

---

## 2. 分支生命周期（短分支原则）

1. **单一主题**：一个分支只做一件事，禁止混杂图标 + 数值 + 对战。
2. **生命周期 ≤ 3 天**：超过即拆分并优先合并，避免长期分叉。
3. **从最新 `master` 切出**，合并前先 `rebase` 到最新 `master`。
4. **不做分支嵌套**：禁止从 `feat/sixsys-*` 再切 `feat/sixsys-*`。
5. **合并方式**：`--no-ff` 保留主题边界（或团队约定的 squash）。

```powershell
git checkout master
git pull --ff-only
git checkout -b feat/sixsys-icons
# ... 仅改动 six-system-arena/ 下的文件 ...
git add "New project/six-system-arena"
git commit -m "feat(sixsys): 接入六系图标模块与数值面板"
git rebase master
git checkout master
git merge --no-ff feat/sixsys-icons
git branch -d feat/sixsys-icons
```

---

## 3. 本轮处理约定（重要）

### 3.1 现状

| 仓库 | 路径 | 分支 | 工作区 |
| --- | --- | --- | --- |
| 主仓库 | `E:\Projects` | `master` | **脏**（7 处未提交变更） |
| zszm 端口 | `D:\Projects\zszm` | `feat/card-balance-admin` | **脏**（7 处未提交变更） |
| 共享 UI | `E:\Projects\shared\shared-ui` | 独立嵌套仓库 | 保持原样 |

### 3.2 本轮决策

> **本轮不强行切分支。**

理由：

1. `E:\Projects` 工作区较脏，切换分支会把未提交变更带入新分支，扩大污染面。
2. 本轮产物**全部新增**在 `six-system-arena/` 下，与既有变更无文件重叠，落盘无冲突风险。
3. 直接落盘为**未跟踪文件**，等主仓库既有变更处理完毕后，再由用户决定统一提交。

**因此本轮执行方式**：产物直接写入磁盘 → 出现在 `git status` 的未跟踪列表中 → 待用户确认后统一纳入某个 `feat/sixsys-<topic>` 分支提交。

### 3.3 后续轮次的推荐做法

一旦主仓库工作区干净：

```powershell
cd E:\Projects
git checkout -b feat/sixsys-baseline
git add "New project/six-system-arena"
git commit -m "feat(sixsys): 六系演武第一轮基础建设"
```

> 提示：`New project/` 下内嵌 8 个第三方 git 仓库（`gallery/`、`motion/`、`skills/`），
> 提交时请**只 add `New project/six-system-arena`**，避免误纳入第三方内容或触发 gitlink 变更。

---

## 4. 禁区

- ❌ 在 `six-system-arena/` 之外新增 / 修改文件。
- ❌ `git add -A` / `git add .`（会连带第三方仓库与不相关变更）。
- ❌ 对 `D:\Projects\zszm` 做任何写操作（本轮）。
- ❌ 对 `E:\Projects\shared\shared-ui` 做写操作（除非显式执行补丁脚本 `--apply`）。
- ❌ 修改数据库 `worldview_luoxiaohei_v4.db`（只读）。
*（内容由AI生成，仅供参考）*
