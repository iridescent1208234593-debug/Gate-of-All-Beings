# 仓库与目录整理记录 · 2026-10-10

## 结果

`E:\Projects-worktrees` 已为空，Git 仅登记 `E:\Projects` 主 worktree。两个相关分支均已成为 `master` 的祖先，分支保留供历史追溯，没有重写任何既有提交。

主目录保留 `server/`、`portal/`、`shared/`、`assets/` 的路径和生产业务实现；没有修改线上进程、部署产物、Tunnel、DNS、账号或远端 Git。

## Worktree 核对与处理

| 原 worktree / 分支 | 检查发现 | 保留与整合方式 | 清理 |
| --- | --- | --- | --- |
| `ops-tunnel-health` / `fix/ops-tunnel-health` | 工作区干净；独有提交 `b2badf2`，四个文件的健康检查实现/文档/测试。全文件清单 1,901 项、457,133,063 字节；未发现主目录缺失的未跟踪/忽略项目文件 | 主分支已有 `83ce100`、`8a87015` 以及未提交的后续网站管家调整。保留后续实现，人工核对后用 ours 策略连接原提交历史；移入仍适配当前接口的三个健康测试。旧 `classify_public` / `overall_state` 测试接口已被后续实现替代，旧测试原文仍在可达 Git 历史中，不复制进生产代码 | 正常 `git worktree remove` 完成 |
| `repo-cloud-pipeline` / `infra/repo-cloud-pipeline` | 原 HEAD `f4004fd`，没有原有独有提交；六个修改文件、四个未跟踪文件。全文件清单 3,858 项、802,522,359 字节；未发现其它独有未跟踪/忽略项目文件 | 先提交全部原型为 `b778172`，再人工选择有效文件整合到主分支。保留本地 manifest / update 工具、384 图清单、依赖锁文件和说明；旧 README 文本不覆盖主站后续文档，改为追加入口；旧云端现场结论改成历史说明。修正原型两个门控条件：认证字符串需明确为 configured；推送完成状态用 verified | 正常 Git 移除后只剩四个 node_modules workspace 链接。删除被自动审批拒绝，因此整体迁入 `E:\New project\归档\worktree残留\repo-cloud-pipeline`；没有触碰链接目标 |

使用 ours 合并是有意的内容选择：对隧道分支保持较新的主目录实现，对云工具分支在合并提交中显式加入有效文件。原提交及未选用的旧文档均保留在祖先历史中。没有把“分支已合并”单独当作代码已整合的证明。

## 主目录结构调整

- 新增 `docs/maintenance/`，集中本次决策与检查记录。
- 原研发根目录零字节 `New project/merge_out.txt` 迁至 `docs/maintenance/archive/merge_out.txt`，补 README，保守保留用途不明确的历史输出。
- 根 README 增加真实目录边界、更新工具、研发与独立创作入口；`docs/README.md` 增加维护和研究入口。
- `New project/README.md` 增加当前整理结果，保留此前审计/设计正文并明确历史边界。
- 新增 `New project/doc/README.md`、`New project/experiments/README.md`。研究资料保留原相对路径，集中索引；没有为了集中而改动研究与实验互相引用的路径。
- 删除 `six-system-arena/legacy/d-drive-r1/tools/derive-from-db_20261005_190906_450.mjs`。SHA-256 与 canonical `derive-from-db.mjs` 均为 `A6928E80DA88CFCF3AB859B79C78E674ED00F03D5395F2EF022BF5A3F6F3B848`，项目源码搜索没有调用引用；Git 可恢复。
- Git 忽略规则增加本地更新报告、三个实验 Python 环境、安装的 JDK 和 Godot 缓存。只调整跟踪边界，没有删除依赖、实验源码或证据。

## 独立创作迁移

`E:\Projects\New project\A小说` → `E:\New project\小说\植物A`。

原文件共 3,420 个、126,047,394 字节。迁移后逐一 SHA-256 一致；此后仅将 `_check_ch10.py` 的旧绝对路径改为脚本相对路径，并新增项目 README。正文、canon、风格卡、章节卡、时间线、三篇历史测试短文、统计与个人审计资料完整保留。原目录未被 Git 追踪，没有可丢失的旧文件提交历史；目标目录仍为本地独立资料区，没有新建远端或自动上传。

小说 `状态.md` 与实际第 11 章文件存在性、canon 定稿表述之间有差异，第 7 章无文件。入口注明这些差异，不代替作者改写创作状态。

## 独立目录结构

```text
E:\New project/
├─ README.md
├─ 小说/
│  ├─ README.md
│  └─ 植物A/
│     ├─ README.md
│     ├─ 正文/                    # 11 个章节文件
│     ├─ canon.md / 风格卡.md / 章节卡.md / 时间线.md / 状态.md
│     ├─ _归档_测试短文_v4pro/      # 三篇历史测试，不作正史
│     ├─ _统计/                    # 历史统计
│     ├─ _audit/                   # 个人审计原件
│     └─ 其余大纲、决策、规划与统计工具
└─ 归档/
   ├─ README.md
   ├─ 整理记录/2026-10-10/         # 状态、完整哈希清单、核对结果
   └─ worktree残留/
      ├─ README.md
      └─ repo-cloud-pipeline/      # 仅依赖链接残留
```

## README 与提交

主仓库新增/修改入口：根 README、`docs/README.md`、`New project/README.md`、`New project/doc/README.md`、`New project/experiments/README.md`、`docs/maintenance/archive/README.md`。更新 `docs/assets.md` 并整合 `docs/update-system.md`。

独立区新增：根 README、小说分类 README、植物 A 项目 README、归档 README、整理记录 README、worktree 残留 README。原有小说归档 README 保持原文。

此次提交（不推送）：

- `b778172`：在原分支保存云更新原型全部未提交内容。
- `53cf5b5`：整合云更新工具、清单、配置与文档，保留主站当前改动。
- `74548ac`：连接隧道健康历史，移入兼容检查，保留后续实现。
- 最终目录整理提交：以 `git log -1 --oneline` 查阅，标题 `chore: organize project indexes and relocate independent creative material`。

## 验证结果与边界

- 两分支 `git merge-base --is-ancestor <branch> master` 均返回 0；两个 worktree 移除前均干净，移除后主工作区是唯一登记项。
- 全文件清单保存在独立归档：`ops-tunnel-health-inventory.json`、`repo-cloud-pipeline-inventory.json`。含路径、大小、SHA-256 和追踪分类。
- 原主仓库现存的 38,954 个目录条目均仍存在于原址或明确迁移位置，无缺失。三个原有 WSL Python 链接在 Windows 下无法解引用，但目录条目原样保留；不是本轮损坏。此项是存在性核对，小说另有全字节校验。
- 本地 384 图 manifest `--check` 通过：319,169,642 字节；两个整合脚本语法检查通过，三个隧道健康测试通过。
- 章节统计脚本从原工作目录执行通过，已正确定位新目录中的第 10 章。
- 验证在 `%TEMP%/iridescently-cleanup-c0ev2i8e` 的隔离副本进行。生产构建输出没有被覆写；本机原端口和线上生产服务没有被重启。
- management、ecology、cards、softie 构建及 juling、slay、aeon 拷贝成功。默认全构建在首页步骤失败：当前未提交的首页脚本要求 `DEFAULT_GALLERY_CDN_BASE_URL`，当前 Gallery plugin 未导出该常量。此为既有源码/配置缺口；本次未改首页业务代码。显式传入 `VITE_ASSET_BASE_URL=https://assets.iridescently.xyz/gallery` 后单独首页构建通过，生成 384 个 CDN 引用。本地构建不证明公网 CDN 当前可用。
- 隔离端口 18080 的门户验证全部 PASS：35 个路由 + 2 个 JSON 断言；原脚本打印 `36/36`，它的 total 统计少算一个 JSON 检查，本次未改业务验证脚本。测试进程已关闭。
- 新建/修改的目录入口 README 本地链接核对通过；生产入口和部署配置路径保持原位。

## 留存与 Git 状态

主仓库没有被“清干净”：保留开始前的会馆/首页/卡牌/聚灵/门户/SSO/UI 等业务修改及原有删除，未混入整理提交。原来的 README/docs 现场文字在追加维护入口时一并保留入提交。

以下内容不擅自删除或迁出：

- DAY100、Gallery、OC/世界观/鸣谢设计资料、六系统、生命模拟研究与阶段 1–4 实验、射击游戏恢复资料及其原始素材：属于网站开发资产。
- `InternalBeyond`、Gallery/motion/skills/reference 的内层仓库：保留设计参考和内层 Git 状态，没有批量提交、移除内层仓库或改写历史。
- 实验 runs/builds、恢复素材、验证截图、工具下载包与模型证据：存在可追溯价值，未因叫“generated”或体积大而删除。
- `.codex-remote-attachments/`、`E:\External Projects\Iridescently Operations\网站恢复/*.bak-20261005`、数据库、用户上传、会话导出：用途敏感/运行数据，保留现场。
- 有功能差异的旧 `SystemIcon`、Garden 独有 dist prompt、DAY100 收集占位：价值未确定，保留。

完整整理前/后 Git 状态在 `E:\New project\归档\整理记录\2026-10-10`；剩余修改和未跟踪项目均有上述归属，不使用 reset/clean 或为了干净而提交全部实验文件。本轮没有运行 update 发布命令、安装主目录依赖或进行云端操作。
