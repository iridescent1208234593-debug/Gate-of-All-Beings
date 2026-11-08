# 众生之门 · 各组制作标准与任务

这里是各组老师的制作标准和首批任务，每组一个文件，可以整份转给对应的老师。策划组在这里细改，改动走 PR，负责人确认后合并。

- 引擎与画面：Godot 4.7.2，横屏 1280×720，逻辑格子 32 像素，网页导出。数字都按这个原型推荐。
- 原型位置：本机 `labs/zszm-godot-map`（不在仓库里），说明见它的 README。
- **P0** = 首个可玩版本必须有；**P1** = 可玩版本之后紧接着做；**P2** = 长期内容，现在不排期。
- 标了「待策划定」的地方，由策划组定稿后改掉这个标记。

| 文件 | 给谁 |
| --- | --- |
| [general.md](general.md) | 所有组：通用交付标准、AI 使用规则、先后顺序 |
| [design.md](design.md) | 总策划组 |
| [art.md](art.md) | 美术组 |
| [ui.md](ui.md) | UI/UX 组 |
| [animation.md](animation.md) | 动画与特效组 |
| [audio.md](audio.md) | 音乐、音效与配音组 |
| [writing.md](writing.md) | 文案与世界观组 |
| [engineering.md](engineering.md) | Godot 客户端、后端与网站、服务器与安全 |
| [support.md](support.md) | 测试、运营与审核、版权与资料、项目管理 |

## 负责人已定的事（2026-11-08）

1. **AI 使用**：尽量避免完全由 AI 生成的作品。作画时可以用 AI 辅助，最终画面由老师自己画，并在素材台账上标明用过 AI。详见 [general.md](general.md)。
2. **主角**：主角是玩家自己的 OC，不设固定主角。美术和动画的任务因此是「小人模板」，而不是画一个主角，见 [art.md](art.md)、[animation.md](animation.md)。
3. **画面方向**：横屏。厚涂手绘为主，角色和小生物可以用粗描边 Q 版，不用像素风和 3D 低模。

## 还待定的事

| 事项 | 谁来定 | 我的建议 |
| --- | --- | --- |
| 首个可玩版本的范围 | 总策划组 | 见 [design.md](design.md) |
| 玩家 OC 怎样变成游戏里的小人 | 总策划组 + 美术组 | 见 [art.md](art.md)「玩家 OC 小人」 |
| 首版是否配音 | 负责人 | 不做整句配音，见 [audio.md](audio.md) |
| 网站安全策略放行游戏（`'wasm-unsafe-eval'`） | 负责人 | 只在游戏页面放行，见 [engineering.md](engineering.md) |
