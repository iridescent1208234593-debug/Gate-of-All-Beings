# @lxh/shared-data

世界观 SQLite 的只读生成产物与小游戏共享目录。当前使用 2026-10-19 香港 `assets-export` 快照：488 条角色源记录，49 条合并跳转，439 名有效角色；133 名详设、230 名具备保留媒体引用。

| 文件 | 用途 |
|---|---|
| `catalog.js` / `catalog.d.ts` | 角色查询、别名消歧、旧 ID 跳转、模式本地 ID 对照与正式类型 |
| `identities.js` | 轻量 ID/名称索引，入口和存档校验不必加载整份人物描述 |
| `worldview.json` / `worldview-data.js` | 同一导出数据的 JSON 与浏览器 ESM 形式，均不手工修改 |
| `arena/` | 从历史恢复的平衡模型与脚本；新生成的 439 名角色数值/卡组。历史五行+空间指标独立于原作六种能力系 |
| `cards.json` / `cards-data.js` | 168 个原生卡牌定义的统一索引；ID 带来源模式，保留原生效果和升级定义 |
| `consolidation.json` | 有效数、旧 ID 跳转、详设匹配和悬空引用报告 |

`export_worldview.py --db <只读快照> --source <来源标识> --media-manifest <assets-export基线JSON>` 生成角色、演武及轻量索引；不提供媒体清单时不选择图片。`npm run data:cards` 从当前原生卡牌定义重建目录。模型、脚本和资料有哈希记录；DB 世界观描述与游戏平衡推导值分开。

所有图片 URL 使用当前保留的角色图库行 ID，不导出磁盘绝对路径，不恢复已删除/未定/同人/真人配图。未确认的能力归属不猜配，原始悬空记录保留在合并报告中。

完整数据契约、存档迁移、验证与其他小游戏接入步骤见 [共同旅途 README](../../docs/ai-handoff/README.md)。
