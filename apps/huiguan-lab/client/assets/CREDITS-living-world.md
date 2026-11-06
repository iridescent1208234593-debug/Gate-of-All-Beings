# Living World Godot 资产来源

本目录为 Phase 1C.2 隔离工程的游戏副本。图片复制自 `E:\Iridescently\labs\zszm-godot-map\assets\world`，其制作过程可核对原工程的 `tools/make_world.py`。导出资产和作者记录位于 `E:\资产\00-项目导出资产\manifest.json`。

## 项目组美术

| 本目录文件 | 作者与来源 |
|---|---|
| `world/grass_day.png` | 程三一，众生之门美术组。由 `backgrounds/grass_topdown_tile_day.png` 制作去缝副本 |
| `world/tree.png` | 程三一，众生之门美术组。由门庭 `backgrounds/gate_parallax/gatetree.png` 提取主要树形并缩小 |
| `world/gate.png` | 程三一，众生之门美术组。由门庭 `gatetree`、`steps`、`gate` 三层合成并缩小 |
| `world/moss_01.png` 至 `moss_11.png` | 海苔。来自 `sprites/props/moss_rocks_plants/moss_rocks_plants_01.png` 至 `_11.png` 的缩小副本 |
| `world/rock_bush.png` | 白鹤。来自 `sprites/props/rock_bush.png` |
| `world/oxalis_1.png` 至 `_3.png` | 车库。来自 `sprites/plants/oxalis/oxalis_stage1.png` 至 `stage3.png` |
| `world/narcissus_1.png` 至 `_3.png` | 车库。来自 `sprites/plants/narcissus/narcissus_stage1.png` 至 `stage3.png` |
| `world/dandelion_1.png` 至 `_3.png` | 车库。来自 `sprites/plants/dandelion/dandelion_stage1.png` 至 `stage3.png` |
| `world/player_front.png`、`player_back.png`、`player_side.png` | 浮笙。来自修订版奶鼠 `sprites/characters/milk_mouse_v2/` 三视图 |
| `world/spirit_small.png` | 水煮鱼。来自 `sprites/characters/spirit_small.png` |

项目负责人在本阶段授权中说明，本地已购及合作方素材可使用、二次修改和公开发布。相关授权随项目资源沿用，原始协作文件继续由素材库保存。

## 字体

`fonts/NotoSansSC.ttf` 为 Google Fonts 的完整 Noto Sans SC 可变字体，采用 SIL Open Font License 1.1。原始版权与完整许可保存在同目录 `OFL.txt`。

- 字体源文件为 `google/fonts` 仓库 `ofl/notosanssc/NotoSansSC[wght].ttf`。
- 来源为 https://github.com/google/fonts/tree/main/ofl/notosanssc 。
- 下载原址为 https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf 。

## 开源实现参考

本次研究了 GDQuest `godot-open-rpg` 的地图、交互与摄像机组织方式。既有地图工程保留了 MIT LICENSE、上游提交 `d59f2f7` 和贡献记录。本工程采用 Godot 内置节点与独立表现脚本，代码参考限于组织模式，复制资源为上述团队图片与字体。上游项目见 [GDQuest 官方仓库](https://github.com/gdquest-demos/godot-open-rpg)。

`contact-sheet.png` 是本次从副本图片生成的查看总览。团队图片的作者与授权依照上表。
