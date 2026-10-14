# 统一后端与门户

`portal_server.py` 按 Host/路径分发静态站点、壳、发布模块、共享资源、API/WebSocket。`base_static.py` 禁止解码后敏感路径、目录列表与数据下载；`hx_sso.py` 复用会馆 cookie；`account_security.py` 保留原账户安全逻辑。

生产8080，OAuth5174，数值配置5178，聚灵5177，Softie4173。旧 game/lingjing/juling 前端域名转入众生之门；API仍留必要上游。源码公开下载 `/app/src` 不允许。

`build:modules` 只生成候选；`publish:modules` 更新 modules；`build:site`/`publish:site` 冻结静态与Python源码。网站管家从发布快照启动 Portal/OAuth，`IRIDESCENTLY_PROJECT_ROOT` 保持原用户数据路径。无自动启动构建。详见 [发布流程](../docs/release-workflow.md)。

开发可 `python server/portal_server.py`，生产用网站管家；`python server/verify_portal.py` 使用未占用端口检查49项路径/JSON/真实模块内容，不接受误连已有服务器。`python server/test_static_security.py` 检查编码/大小写敏感文件拦截。
