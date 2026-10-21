# 交接：让 zszm 隧道直连并优先占用带宽（给 GPT 执行）

目标：`https://zszm.iridescently.xyz` 在众生之门注册高峰时不卡。后端瓶颈 Claude 已修完，剩下是本机网络层。
你只做本文件「任务」一节的事。其余一律不动。

## 已完成（不要重做，也不要回滚）

2026-10-17 20:50 左右，Claude 已改并重启线上服务：

- `server/app/src/cards/server.py`：OAuth 代理（5174）由单线程 `HTTPServer` 改为 `ThreadingHTTPServer`，队列 512。
- `server/portal_server.py`：门户（8080）监听队列由 5 提到 1024。
- `portal/huiguan/server_huiguan.py`：注册时 scrypt 哈希移到 `DB_LOCK` 之外；`users.db` 开 WAL，`timeout=30`。
- `server/base_static.py`：带内容哈希的 `/assets/*` 改为 `max-age=31536000, immutable`，并补 `.ttf/.otf` 缓存。
- 以上已同步到 `E:\Projects\.releases\production\site`（改前备份在 Claude 的 scratchpad，无需你处理）。
- 已杀掉一个失控的 `find.exe`。

注意：线上快照的 manifest 哈希现在与实际文件不一致，下次正规发布会消除。不要手改 `.releases/production`。

## 测量结论

- 整机上行约 1.5 Mbps，没有程序在占带宽。限制其他程序没有意义。
- 本机 Clash Verge 开着 TUN（`gvisor`、`fake-ip`、`auto-route`），默认路由走 `Meta` 网卡。
- 规则里没有给 `cloudflared.exe` 或 `argotunnel.com` 配 `DIRECT`，只在 `fake-ip-filter` 里有 `+.argotunnel.com`。
  所以隧道流量很可能落到最后的 `MATCH,节点选择`，也就是走代理节点。这个只是推断，没有被证实。
- 默认网关在 `WLAN`。有线「以太网」没有网关（IP 192.168.77.1，疑似共享或虚拟网卡）。
- 当前电源方案：平衡。

## 任务

### 任务 0：先验证推断（只读）
确认 cloudflared 的出口是否真的经过 mihomo。可用的办法：

- 查看 Clash Verge 的连接列表，找 `cloudflared.exe` 的连接及其命中的规则和节点。
- 或查看 `节点选择` 当前选中的节点是不是 `DIRECT`。

把结果写进下面的「回报」。如果已经是 `DIRECT`，任务 A 不用做。

### 任务 A：给隧道加直连规则（会重载 Clash，会让用户自己的代理断几秒）
**动手前先在对话里告诉用户并等明确同意。**

1. 配置目录：`%APPDATA%\io.github.clash-verge-rev.clash-verge-rev\`。
2. 不要直接改生成文件 `clash-verge.yaml`，它会被覆盖。通过 Clash Verge 的 Merge 或 Rules 增强配置加规则。
   当前生效的 profile uid 是 `R5bDzPqaU14M`，先看 `profiles.yaml` 里它挂了哪些增强项再决定改哪个文件。
3. 在规则最前面加三条：
   ```
   - PROCESS-NAME,cloudflared.exe,DIRECT
   - DOMAIN-SUFFIX,argotunnel.com,DIRECT
   - DOMAIN-SUFFIX,cloudflare.com,DIRECT
   ```
4. 改之前把被改的文件复制一份到同目录，加 `.bak_<日期时间>` 后缀。
5. 在 Clash Verge 里重载配置。
6. 验证：
   - `cloudflared` 的新连接显示为 `DIRECT`。
   - 公网请求仍然 200：`https://zszm.iridescently.xyz/`、`/api/sso-user`、`/api/gate/identity`。
   - 用户自己的代理还能用。
7. 失败回滚：还原备份并重载。

### 任务 C：网卡与电源（风险低，可直接做，做完告诉用户）

- 关闭 `WLAN` 网卡的省电：高级属性里关闭「节能/Power Saving/Green」之类的项，或用 `powercfg` 的无线适配器节能设置改为「最高性能」。
- 电源方案由「平衡」改为「高性能」：`powercfg /setactive SCHEME_MIN`。
- 记下改前的值，方便回滚。

## 不要做的事

- 不要重启或停止 cloudflared、portal_server、OAuth 代理。它们正在服务线上用户。
  需要重启时先问用户，并走网站管家：`ops/网站恢复/website-manager.py`。
- 不要改 `~/.cloudflared/config.yml`。
- 不要往 `.releases/production` 写任何东西。
- 不要 commit、push、publish。
- 不要杀用户的其他进程，也不要限速其他程序。
- 不要把密钥、cookie、token 写进回报。

## 回报

做完后在 `E:\Projects\docs\ai-handoff\LOCAL_AGENT_REPORT.md` 追加一节「网络调优」，写明：

- 任务 0 的验证结果（cloudflared 实际命中的规则和节点）。
- 改了哪些文件和设置，备份文件名。
- 验证命令和结果。
- 回滚方法。

## 备注（给用户看的，用户自己做）

- 把网线接到路由器，让有线成为默认出口，延迟和稳定性比 Wi-Fi 好。这一步 AI 做不了。
