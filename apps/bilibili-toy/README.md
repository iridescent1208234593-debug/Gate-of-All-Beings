# B站 Toy 门庭页

西木会馆在 B站 Toy 上的门庭：介绍项目、发布公告，实时显示会馆档案室（同人人气前十、官方角色档案），提供去会馆和众生之门游戏的外链，并用 Toy SDK 的站内跳转把访客带到项目方的 B站 空间。它是独立分发渠道，**不是**会馆网站的一部分：不含账号、登记、上传或管理后台；只读取会馆的匿名接口 `/api/toy/archive`，外链只到 `content.json` 里 `site` 批准的 `.cn` 主机。

完整的可行性分析、风险检查表和撤回方案见 [docs/bilibili-toy.md](../../docs/bilibili-toy.md)。

## 文件

| 文件 | 谁改 | 作用 |
| --- | --- | --- |
| `content.json` | 负责人 | 标题、介绍、项目列表、公告、B站 跳转目标、版权与免责声明 |
| `assets/assets.json` | 负责人 | 进包图片的登记表：每张图写 `path`、`author`、`rights`（`owner` 或 `licensed`），协作者作品必须先拿到书面授权 |
| `src/index.html`、`src/style.css`、`src/toy-page.js` | 开发者 | 页面模板、样式、SDK 调用 |
| `../../tools/toy/build-toy-bundle.mjs` | 开发者 | 构建 + 安全检查；检查不过就删掉产物，不留可上传的坏包 |

`content.json` 的 `bilibili` 段：

- `space_mid`：项目方发布账号的 UID（数字）。正式发布必填，`--release` 会检查。
- `tribee_id`：西木会馆 B站 小站 id（数字），没有就留空。
- `videos`：`[{ "bvid": "BV...", "label": "介绍视频" }]`，只能是项目方账号自己的视频。

## 构建

```powershell
# 在仓库根目录；--out 必须是仓库外的新目录或空目录
node tools/toy/build-toy-bundle.mjs --out E:\Iridescently\toy-out\20261104 --release
# 只检查一个已有的包
node tools/toy/build-toy-bundle.mjs --check E:\Iridescently\toy-out\20261104
# 回归测试
node --test tools/toy/test-toy-bundle.mjs
```

安全检查会拒绝：项目自有域名（三根域任一、任意子域）、除官方 Toy SDK 以外的任何外链、站点路由（`/api/`、`/app/`、`/admin/`、`/uploads/`）、IP 与 localhost、像凭据的字段名、`iframe` 与表单输入、`fetch` / `location` 跳转等直接网络或跳转、根绝对路径、源码映射与 `.env` 等文件、入口超过 1MB 或整包超过 50MB、未登记或未授权的图片。

## 发布（只由项目方用自己的账号操作）

开发者只交付构建好的文件夹，不登录、不上传、不提交审核。负责人自己：

1. 安装官方 `toy` CLI（见 <https://github.com/bilibili/toy>）后 `toy login`，在浏览器里用**项目方 B站 账号**授权；`toy whoami --json` 确认账号无误。也可以直接在 Toy 发布平台网页上传文件夹。
2. 首次：`toy create <包目录> --json`（不带 `--yes`）得到预览链接，在手机 B站 App 和电脑上各看一遍。名称、slug（发布后不可改，建议 `ximu-huiguan` 这类）、封面、可见性按 `toy create --help-json` 当前列出的参数填写。首发建议可见性选 `link-only`（仅链接可见），确认无误后再改 `public`。网页表单各栏填法见 [docs/bilibili-toy.md](../../docs/bilibili-toy.md)，封面和图标用 `node tools/toy/render-poster.cjs <目录>` 生成。
3. 确认后用同样参数加 `--yes` 提交审核。审核约十分钟，可能未通过，按拒绝原因改后重提。
4. 之后更新：`toy mylist --json` 找 id → `toy update <id> <新包目录> --json` 预览 → 确认后加 `--yes`。slug 保持不变。
5. 把视频挂上 Toy 入口：`toy video bind`（即时生效，可随时 `unbind`）。

## 撤回与下架

- 暂时撤回：`toy update <id> --visibility password --access-password <4-32位>`（或 `link-only`）后 `--yes`，Toy 从广场消失，只有知道密码 / 链接的人能打开。改回 `public` 即恢复。
- 回滚内容：用上一版本的 Git 提交重新构建，再走一次 `update`。
- 彻底下架：删除 Toy 发布时自动生成的关联动态，平台会同步删除 Toy（不可恢复）。官方 CLI 没有删除命令。
- 第三方退出合作：他从来没有项目方账号的登录态，无需交接；项目方吊销其仓库权限即可，Toy 不受影响。
