# 候选、源码快照与显式发布

正式源码在 E:\Projects；实验/参考在 E:\External Projects\Iridescently Labs。生产服务与尚未发布的编辑分开。

| 命令 | 结果 |
| --- | --- |
| `build:homepage` | `.releases/candidate/homepage` |
| `build:modules` | 七个模块和首页候选 |
| `publish:homepage` / `publish:modules` | 校验全文件 SHA-256 后提升构建输出 |
| `build:site` | 从 Git HEAD 导出 portal/server/shared 源码快照到 candidate/site |
| `publish:site` | 提升到 `.releases/production/site` |

构建不等于上线。网站管家不再启动时自动构建；缺少发布产物则明确报错。源码快照不包含 node_modules、gallery-engine、上传/store、数据库、角色/存档 JSON、环境文件和生成模块。首页生成 HTML/assets 继续从显式发布输出读取。

Portal/OAuth 从已发布快照启动；`IRIDESCENTLY_PROJECT_ROOT` 指向原工作区的用户数据、共享媒体与本地 SSO secret。会馆公共 UI 使用 canonical shared/shared-ui，不需要另维护一份镜像。静态 HTML/CSS/JS/Python 源码的未发布修改不影响正在运行的快照。

候选 JSON 记录 sourceHead/sourceDirty、时间、文件 hash；production.json 仅在显式发布成功后合并组件记录。工作树有修改的模块构建不能声称是纯提交构建；最终发布时应使用审查提交或附有逐文件比对证明。site 始终取 HEAD。

顺序：审查并提交源码 → 构建候选 → 测试 → 显式发布 → 仅重启受影响服务 → 公网验收。代码/数据库不一起覆盖；数据库及上传需要单独备份。门户、OAuth、API 上游和 Tunnel 的重启由现有网站管家完成，不引入新 CDN/DNS。

publish 先复制、验证，再逐目录提升，异常逆序恢复；中断的 `.promotion` 会阻止覆盖，需要检查恢复。多目录发布不是零停机原子切换，维护窗口中完成一致切换。要回退版本，检出已知提交重新构建/发布，用户运行数据不回滚。

Cards/Softie Vite API 插件仍从正式源目录在进程启动时加载；其静态输出明确使用发布目录，开发修改不会热更新到 preview。改 API 插件同样要提交、测试和显式重启，不能声称所有 Node 源码已快照隔离。
