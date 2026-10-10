# 默认首页构建修复与 Git dirty 审计 · 2026-10-10

范围：读取上一轮整理报告，修复资源根地址的默认值/override，仅审计其余业务现场。没有移动目录、重构模块、部署、重启线上服务、安装依赖或推送 Git。

## 根因与最小修复

1. 工作区首页发布脚本解构导入了插件未导出的 `DEFAULT_GALLERY_CDN_BASE_URL`，环境值未设置时对 `undefined` 调用 `.replace()`，开发命令也会在启动 Vite 前遇到这一处错误。
2. 当前 Gallery 插件只使用 `import.meta.env.BASE_URL` 生成本地 URL，且总是复制图库；发布脚本却按环境变量判断 CDN 模式。因此上一轮的“显式变量构建成功”没有证明 CDN 路径真的写进 bundle，也没有证明停止了图库复制。
3. `.env.example` 不是 Vite 自动读取的配置；当前 portal/Gallery 没有实际 `.env` override。Vite config 和 npm scripts 没有提供隐式默认值；仓库没有 `.github` CI 目录，已有模块/更新脚本仅调用相同首页构建入口。`scripts/asset.js` 已有本地 `/assets` fallback，无需修改。

修复使用一个小的 `resolveGalleryAssetBase(env)` 函数：未设置或显式空字符串均返回空根地址；去掉空白和末尾斜线。Gallery 与发布脚本共用这个规则，没有生产域名常量。

- 默认：Gallery URL 为 `import.meta.env.BASE_URL + gallery-files/...`；生产构建复制本机图库并校验源文件哈希，开发 middleware 继续提供本地图。
- 覆盖：`VITE_ASSET_BASE_URL` 是包含 `gallery-files/` 的资源根目录；HTTP(S) 地址写入真实 Gallery URL，停止复制本地图。相对站点根覆盖仍保留本地复制。
- 发布脚本使用安装的 Vite `loadEnv('production', homepageRoot, 'VITE_')`；插件读取同一个 resolved config.env。实际安装版本的 loadEnv 源码确认：进程变量优先于 mode-specific 文件，再按 Vite 文件优先级加载。
- `portal/www/.env.local`、`.env.production.local` 可供本机配置；Gallery 单独运行时使用它自身根目录的环境文件。`.env.example` 只作模板。开发模式不会读取 `.env.production.local`。
- 空进程 override 能显式覆盖文件中的 CDN 配置、回到本地；不用额外手动注入变量即可运行默认 build。

源码修改仅四处：`portal/www/scripts/build-homepage.mjs`、`portal/www/.env.example`、`New project/gallery/codrops-depth-gallery/gallery-plugin.js`、同目录 `tests/gallery.mjs`。首页脚本原有未提交差异均属于 CDN 发布机制；此次只把与该配置修复直接相关的构建机制纳入专项提交，其它现有业务修改不纳入。

## 验证

全部构建在上一轮 `%TEMP%/iridescently-cleanup-c0ev2i8e` 隔离副本进行，复制本轮四个修复文件。生产目录的 index、部署资产和 modules 输出不被本轮构建覆写。

| 检查 | 结果 |
| --- | --- |
| 不设置 VITE_ASSET_BASE_URL 的 `npm run build:modules` | 通过；四个 Vite 模块、三个静态模块及默认首页全部完成 |
| 默认首页本地素材 | 384 文件，发布脚本逐个 SHA-256 校验；另核对真实输出均与源图相同 |
| Gallery `npm test` | 通过原有发现/排序/编码/取色检查，以及新增默认、相对根、CDN URL、复制与环境优先级回归 |
| `.env.production.local` CDN override | 构建通过；真实 bundle 含测试 CDN 根，图库目录不存在，无本地图副本 |
| 进程环境 override 覆盖上述文件 | 构建通过；真实 bundle 只包含进程指定根，未采用文件根；末尾多斜线正确规范化 |
| 默认开发 Vite | 首页 HTTP 200；本地图 GET 哈希和 HEAD 长度通过；virtual Gallery 模块为空 override，开发模式不采用 production.local 文件 |
| 门户 `npm run test:portal` / 隔离端口 18080 | 35 路由 + 2 JSON 断言全部 PASS；原验证脚本计数打印仍是 36/36，本轮不改该脚本 |
| `npm run assets:manifest -- --check` | 384 图、319,169,642 字节清单通过 |
| 隧道健康现有测试、修复文件 diff --check | 通过 |

CDN 测试使用不可联网的示例 `.invalid` 域名，检查的是实际构建 URL 和复制行为，没有远端上传或公网 CDN 可用性声明。构建保留原有 chunk size / dynamic import 提示，没有新增构建失败。

## Dirty 审计覆盖与材料

开始快照：**48 modified、10 deleted、18,908 untracked 条目**。10 个 deleted 是上一轮前就存在的业务/文档删除，不是此次删除。

Git ignored 枚举返回 **192,483 条目**。Windows 对一个超长 pnpm 依赖路径给出枚举警告，因此这份清单覆盖 Git 返回的全部路径，不声称对无法枚举的依赖子树做过全内容审计。分类是逐路径归属判断并抽查关键差异，不等于对 21 万个依赖/资产文件逐行代码审查。

局部材料保存在 `E:\New project\归档\整理记录\2026-10-10\followup`，不纳入项目 Git：

- `dirty-before.json`：完整 modified/deleted/untracked 起始状态。
- `ignored-paths.json`：完整 Git 返回的 ignored 路径。
- `dirty-classification.csv`：所有上述条目的六分类、理由、状态和可读大小。
- `nested-repositories.json`、`nested-dirty-classification.csv`：24 个内层仓库的分支、完整 dirty 状态及 107 个内层 dirty 条目分类。
- `dirty-hashes-before.json`、`preserved-dirty-check.json`：18,943 个可读、非本轮构建修复的已有 dirty 文件 SHA-256 复核，**零改动**。原有 deleted 及不可解引用的 WSL 条目不伪称哈希通过。
- `dirty-after.txt`：提交完成后的现场状态，另保存最终 commits。

## 分类表（完整逐路径版本见 CSV）

| 分类 | 内容 | 判断 / 下一步 |
| --- | --- | --- |
| 1 应提交 | 本轮构建修复；生命研究文档、鸣谢材料、DAY100 创作源码、射击 Web 真源及验证工具；Avida 兼容补丁、Latticefolk 本地 Playwright 配置 | 现有材料本轮不提交。下轮检查公开/许可范围，按功能成组提交；Avida 的 `not` → `!` 需提取为可复现实验补丁，保留上游历史 |
| 2 开发中暂留 | 会馆首页拆分与海报编辑、主站导航/动效/连接/音乐代码、卡牌 Gate/聚灵/门户/SSO、六系统 R10 候选、阶段 1–4 实验源码 | 与配套新增文件及旧入口删除整体审阅，不按单文件盲目提交 |
| 3 应忽略 / 已正确忽略 | 连接器附件、node_modules、venv/JDK、COMETS 解包及下载包、构建输出 | 唯一立即修复是 `/.codex-remote-attachments/`。其它安装包规则只是建议，没有扩大 ignore；不要把运行证据或实验修改一并隐藏 |
| 4 应归档 | DAY100 内部采集/历史版本、实验 runs/results、Playwright trace/截图、会馆 capture artifacts、射击恢复原件与工具、旧 SESSION_HANDOFF、两份 `.bak-20261005` | 保留来源/哈希/失败证据；内部截图可能有个人信息。仅提出归档建议，文件位置不动 |
| 5 可删除（有条件） | Python/Godot 缓存、实验构建副产物、临时构建 staging | 确认无运行依赖且可再生成后才可删；本轮没有删除。正在服务的 modules/homepage 输出不属于直接可删范围 |
| 6 不明确，不处理 | 异常转义/重复空行的 REFERENCE_BASELINE、角色本地编辑数据、个人/收款二维码、音频许可、外部数据/数据库/上传、InternalBeyond 初始暂存、参考 clone、已变更的迁移提示词 | 先明确来源、公开边界、格式变化与仓库归属；不自动提交、隐藏或删除 |

## 关键具体发现

- `New project/REFERENCE_BASELINE.md`：净变化约 1,549 插入 / 546 删除，包含标题反斜线、重复空行和被反复转义的绝对路径；不能当普通文档更新直接提交，建议下一轮对照 Git 逐段核实。
- `portal/huiguan/characters.json`：新增 `local:196` 等本地角色记录及 html_ref 变化，可能是用户编辑数据，单列类别 6。
- 六系统候选从 R9 更新到 R10，新增 18 张微信表情候选并标记待人工复核。索引与候选原件一起暂留，不当正式资源发布。
- `提示词/动画加载优化提示.txt` 的既有删除与 `New project/提示词/动画加载优化提示.txt` 新文件字节不相同；不要未经核对当成纯移动。
- 主仓库 package/lock/requirements 无现存 dirty 变化；本轮没有安装或改依赖。根锁文件声明 Wrangler 4.147.0，但根 node_modules 尚无 Wrangler，属于安装状态未满足，不自动 npm install。
- Depth Gallery 内层已有 README/vite.config 相对目录调整，父仓库已含相应真源，内层相对自身 HEAD 仍 dirty；本轮的插件/测试在父仓库提交，**不额外提交内层仓库**。
- Avida：仅一处 Windows 兼容 C++ 修改 `not` → `!`。cometspy：四个 `.egg-info` 文本和五个已被上游追踪的 `.pyc` 修改；添加 ignore 不能取消这些既有追踪。
- Latticefolk：22 个浏览器报告/trace 文件（类别 4）及一个 Playwright 配置（类别 1）；resistance_microb_invasion：三个未跟踪字节码（类别 5）。
- InternalBeyond：67 个初始暂存条目且无有效 HEAD；不擅自创建提交或抹掉暂存。
- 图片、截图、SQLite、上传和外部数据已经 ignored，也不意味着允许删除；它们是本地/部署输入或证据。

## 下轮建议

1. 先确认 REFERENCE_BASELINE 格式异常、角色/二维码/音频的公开边界和迁移提示词差异。
2. 生产业务按会馆、主站、卡牌/门户路由三个逻辑批次核验，配套源码和测试一起提交，生成 index 与源入口保持一致。
3. 生命模拟实验将自有源码、上游补丁、安装清单、原始运行证据分别确定 Git 边界；尤其不要将完整 COMETS/JDK 分发包和内层 .git 直接加入父仓库。
4. 再处理旧接续快照、备份和重复运行证据的归档；只有可再生成且无运行依赖的缓存才考虑删除。

## 本轮 Git 边界

单独 ignore 提交：`c5f6f1f`（仅 .gitignore 一行）。构建修复提交标题：`fix(homepage): default to local gallery assets and honor CDN overrides`，具体哈希见本轮最终报告和 `git log -1`。

除本轮四个修复文件、该 ignore 行和本审计报告外，没有提交任何现有业务修改、实验源码或证据。主仓库预计仍保留 47 modified、10 deleted 和约 18,902 untracked 条目；最终精确状态以 followup/dirty-after.txt 为准。没有 push。
