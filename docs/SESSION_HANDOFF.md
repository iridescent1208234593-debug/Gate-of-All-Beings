# Iridescently 项目交接

更新时间：2026-10-05（Europe/Berlin）

## 交接区

- 编号：`IRIDESCENTLY-2026-10-05-01`
- 源对话编号：未确认
- 项目目录：`E:\Projects`
- 状态：材料已核对，等待新对话读取
- 用户要求：保存当前进度，切换到新对话；本文件不代表额外的提交、推送、授权或 Cloudflare 变更许可。

## 当前目标

安全维护 `iridescently` 私有 GitHub 仓库，并准备未来的 Cloudflare R2 / CDN 资源迁移。保持现有页面和功能，不丢失素材，不做整站资源替换，不上传 R2，不改 DNS。

## 已完成并核实

- 根仓库在 `master`。最新提交为 `f4004fdb`：`feat: refine homepage brand and gallery interactions`。
- 已将 9 个 `portal/www/` Homepage 改动提交并推送到 `origin/master`；最新核对时 `HEAD` 与 `origin/master` 一致。
- 该组改动覆盖品牌颜文字交互、Gallery 减少动态效果处理、相关样式和维护说明。提交前检查差异、密钥模式和 `git diff --check`；仅这 9 个目标文件进入提交。
- `npm run build:homepage` 通过，报告 384 个图库资源且 SHA-256 匹配。构建给出 JS 分块超过 500 kB 的提示（非失败）。
- `npm run test:portal` 通过，31/31。
- Chrome 中可打开私有仓库 `iridescent1208234593-debug/iridescently`；GitHub 登录用户与仓库 owner 一致。
- Cloudflare Dashboard 中 `iridescently.xyz` 出现在当前已登录账户下。R2 页面显示需先开通 R2 订阅；未开通、未创建 bucket、未上传对象、未变更 DNS。
- R2 / 资源约定和当前 `asset()` 用法记录在 [assets.md](assets.md)。首页 helper 位于 `portal/www/scripts/asset.js`，公开环境变量是 `VITE_ASSET_BASE_URL`；未配置时使用本地路径。helper 已存在，不代表已完成全站迁移。
- 当前首页 Gallery 素材仍保留在本机原路径；未移动或删除大型素材。

## GitHub 连接器阻塞

- Codex 的 GitHub 连接器登录用户已核实为 `iridescent1208234593-debug`，但 `github_get_repo` 对私有仓库仍返回 404，列出的仓库为空。
- Chrome 的 GitHub Settings → Applications 显示该账号没有已安装的 GitHub App；授权 OAuth Apps 页面只显示 Git Credential Manager。
- 下一步需要用户在 ChatGPT 的 GitHub 连接设置中重新授权 `iridescently`，优先限于这个仓库，然后复查连接器是否可读。不要擅自启用“所有仓库”访问。

## 本轮新发现的未提交工作区内容

最近一次状态检查显示 `master` 与 `origin/master` 对齐，同时以下内容未提交：

- 两个已修改文件：`E:\External Projects\Iridescently Operations\网站恢复/打开网站管家.vbs`、`E:\External Projects\Iridescently Operations\网站恢复/网站管家使用说明.md`
- 未跟踪目录：`.codex-remote-attachments/`
- 两个未跟踪备份文件：上述 VBS 与说明文档各有一个 `.bak-20261005` 文件

这些内容没有在本次交接中检查或修改。新对话开始时先只读检查 `git status` 和这些文件的差异，保留它们；不要把它们混入 Homepage 提交或随意删除。

## 明确边界

- 不上传 Cloudflare R2，不开通订阅，不改 DNS。
- 不删除、移动正在使用的大型图片、视频、音频、GLB 或纹理。
- 不批量替换站点资源 URL，不重写 Design System，不改无关业务。
- `.env.local` 与凭据保持本地；交接文件中不记录密钥或个人登录凭据。
- 后续更改先检查来源和引用；不确定是否应忽略、迁移或删除时保留。

## 新对话第一步

在 `E:\Projects` 打开本文件并核对现场。先确认最新 Git 状态和两个 `E:\External Projects\Iridescently Operations\网站恢复` 文件的差异与 `.codex-remote-attachments/` 内容归属；不要修改或提交它们。然后处理 GitHub 连接器重新授权的用户操作，并用连接器只读复查 `iridescently`。之后再规划 R2 订阅、bucket/key 结构、CDN 自定义域名与小规模验证；任何订阅或权限变更须停在明确确认边界。

### 可复制到新对话的开场白

> 请从 `E:\Projects\docs\SESSION_HANDOFF.md` 恢复 Iridescently 项目。交接编号 `IRIDESCENTLY-2026-10-05-01`。先只读核对当前分支、`HEAD`/`origin/master` 和文中列出的未提交 ops 文件及附件目录，保留这些现场状态；然后告诉我差异。GitHub 私有仓库已推送，但 ChatGPT 连接器仍访问不到它，需要我在 GitHub 连接设置里给 `iridescently` 授权后再检查。Cloudflare 域名在已登录账户下，R2 订阅尚未开通；先规划，不要开通订阅、改 DNS、创建 bucket 或上传资源。保持原有功能、视觉和素材。
