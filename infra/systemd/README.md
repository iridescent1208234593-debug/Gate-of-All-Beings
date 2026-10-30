# 数值后台与灵质空间的后台服务

这两个服务是「众生之门」里数值后台（卡片数值覆盖）与灵质空间（spirit，软体宠物）的
HTTP 后端。它们以前用 `vite preview` 提供，站点迁移到规范布局后**旧路径全部失效**，
表现为前端提示：

```
数值后台未启动，请使用本地开发或预览服务。已暂停历练操作。
```

## 为什么坏

原单元指向迁移前路径：

```ini
WorkingDirectory=/srv/iridescently/current/server/app/src/cards          # 不存在
ExecStart=.../current/server/app/src/cards/node_modules/vite/bin/vite.js # 不存在
```

而且入口也用错了 —— 真正的后端是**打包好的独立 Node 服务**，不需要 node_modules：

| 服务 | 端口 | 入口 |
|---|---|---|
| 数值后台 | 5178 | `site/apps/cards/server/balance-service.mjs` |
| 灵质空间 | 4173 | `site/apps/softie/server/spirit-service.mjs` |

这两个 `.mjs` 是 esbuild 产物，依赖已内联，因此**不需要 `npm install`**。

## 第三个坑：必须带环境变量

直接运行会立刻退出：

```
Error: storage is not ready; initialize fixtures or complete verified migration first
```

必须设置：

```ini
Environment=IRIDESCENTLY_STORAGE_ROOT=/srv/iridescently/new/<release>
Environment=IRIDESCENTLY_ENVIRONMENT=production
```

## 部署步骤

```bash
# 1) 复制单元（把 <release> 换成当前发布目录）
cp infra/systemd/iridescently-balance-next.service /etc/systemd/system/
cp infra/systemd/iridescently-softie-next.service   /etc/systemd/system/
sed -i 's|/srv/iridescently/new/20261026T113632Z|/srv/iridescently/new/<release>|g' \
  /etc/systemd/system/iridescently-balance-next.service \
  /etc/systemd/system/iridescently-softie-next.service

# 2) 重载并启动
systemctl daemon-reload
systemctl reset-failed iridescently-balance-next iridescently-softie-next 2>/dev/null
systemctl restart iridescently-balance-next iridescently-softie-next
systemctl is-active iridescently-balance-next iridescently-softie-next

# 3) 验证
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5178/api/card-balance
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/api/spirit-settings
```

前端实际调用路径（经 portal 代理）：

```
/app/modules/cards/api/card-balance      → 127.0.0.1:5178
/app/modules/softie/api/spirit-settings  → 127.0.0.1:4173
```

两者的代理端口在 `services/platform/portal_server.py` 的 `PROXY_PORTS` 里定义。

## 排查要点

- 服务 `activating` 反复重启 → 看 `systemctl status` 里的 `code=exited, status=200/CHDIR`，
  说明 `WorkingDirectory` 不存在（路径过期）
- 服务立刻退出且日志是 `storage is not ready` → 缺环境变量
- 端口被占（`status=1/FAILURE` 且提示 address already in use）→ 检查是否有手工
  `nohup node ...` 起的进程，先杀掉再 `systemctl restart`
- 前端仍提示未启动 → 直接 curl `127.0.0.1:5178/api/card-balance`，
  区分是后端挂了还是代理没转发

## 历史

2026-10-28：两个服务因旧路径失效停摆，用户报「数值后台未启动」「部分玩法玩不了」。
改为上表的 `.mjs` 入口 + 环境变量后恢复，`revision` 与 `overrides` 数据完好。
