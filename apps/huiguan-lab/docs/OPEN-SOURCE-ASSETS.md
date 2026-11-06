# 开源依赖、素材来源与许可

## 已集成到 LAB 构建

| 组件 | 来源 | 版本 / 提交 | 许可 | 用法与修改 |
|---|---|---|---|---|
| Godot Engine 与 Web 导出模板 | godotengine.org | 4.7.2.stable.official.ed1daf0bf | MIT | 引擎与网页运行时，没有修改 |
| 3D-Pixel-Campfire | https://github.com/Wayoung7/3D-Pixel-Campfire | 47ab13299f94d511f445e1203db58f80de0c4cd6 | MIT，© 2026 Y.Y Wang | `client/third_party/3d-pixel-campfire/` 原样保留源文件和 LICENSE。只改了资源路径（沿用栖风原的副本）。运行时取出 Campfire 子树，火焰光线步进次数降到 24，`surface.gdshader` 用作 3D 视图的分级光照材质。上游的 `main.tscn` 不进入导出包 |
| Noto Sans SC | https://github.com/google/fonts/tree/main/ofl/notosanssc | 可变字体 | SIL OFL 1.1（`client/assets/fonts/OFL.txt`） | 用 fonttools 裁出 GB2312 加 ASCII 子集（7,542 字），保存为 woff2，约 2.0 MB |
| 众生之门团队美术副本 | 栖风原 `assets/world`（原件在 `E:\资产`，作者见 `client/assets/CREDITS-living-world.md`） | 2026-11-05 副本 | 负责人授权：已购与合作素材可使用、二次修改和公开发布 | 草地、树、门、苔石、花的三个生长阶段、奶鼠三视图、小精灵 |
| FastAPI / Starlette / Pydantic | PyPI | 0.115.x / 0.46.x / 2.x | MIT | 网关 |
| uvicorn + websockets | PyPI | 0.32.x / 13.x | BSD-3 | HTTP 与 WebSocket 服务 |
| Pillow | PyPI | 11.3 | MIT-CMU（HPND） | OC 图片校验与重新编码 |
| psutil | PyPI | 6.1 | BSD-3 | CPU、内存、网络指标 |
| httpx | PyPI | 0.28 | BSD-3 | 网关调用 R4 |
| brotli | PyPI | — | MIT | 构建时预压缩 |
| fonttools | PyPI | 4.x | MIT | 字体裁剪（只在构建时使用） |
| pytest / Playwright（Python） | PyPI | 8.x / 1.64.1 | MIT / Apache-2.0 | 只用于测试，不进入运行时 |
| R4 Living World Service 与 Mesa 研究栈 | 本项目 `labs/iridescently-labs` | 本机研究代码 | 项目自有 | 作为独立进程运行，没有修改 |

捏人编辑器（`client/scripts/avatar_editor.gd`）的所有部件都用代码绘制，没有使用第三方图片，因此生成的形象不附带额外许可条件。

## 评估过但没有集成

| 候选 | 地址 | 情况 | 结论 |
|---|---|---|---|
| Godot 官方 websocket_multiplayer 示例 | godotengine/godot-demo-projects `networking/websocket_multiplayer` | MIT。演示的是 MultiplayerAPI 加 WebSocketMultiplayerPeer，权威端必须是 Godot | 借鉴了思路：客户端用 WebSocketPeer。权威端要和 Python 的 R4 放在一起，所以没有采用 MultiplayerAPI |
| gd-character-creation | https://github.com/Flynsarmy/gd-character-creation | Godot 4，约 21 星，2023-10 以后没有更新 | 维护停滞，美术方向不符，没有采用 |
| Universal-LPC-spritesheet | 本机 `labs/godot-candidates/Universal-LPC-spritesheet`（2013） | 根目录没有许可文件。LPC 素材通常是 CC-BY-SA 3.0 或 GPL 3.0，需要逐图署名，而且是 copyleft | 不进入公开构建。可在许可允许的范围内单独评估 |
| LPC 分层纸娃娃插件（itch.io） | 见 itch.io 的 LPC 标签 | 搜索结果里看不到仓库和许可 | 许可不明，没有采用 |
| character-generator-importer-tool | github.com/ninetailsrabbit/character-generator-importer-tool | MIT，Godot 4.4。它是外部生成器的动画导入工具，本身不是编辑器 | 不适用 |
| painted-characters | 本机候选 `painted-characters`（Summer Labs，MIT） | 4 个八方向写实角色 | 画风不符，没有采用 |
| godot-open-rpg | 本机候选，d59f2f7，MIT | 格子地图与交互 | LAB 用的是连续坐标，只参考了组织方式 |
| dialogic / dialogue_manager / limboai / phantom-camera / Terrain3D / scatter 等 | 本机 `labs/godot-candidates` | 均为 MIT | 第一阶段用不到，留给 ROADMAP（剧情对话、NPC 行为树、地形） |

公开的 GitHub 仓库不等于素材可以自由使用。所有候选都核对过 LICENSE 文件；许可不明的素材只能留在候选目录里评估。
