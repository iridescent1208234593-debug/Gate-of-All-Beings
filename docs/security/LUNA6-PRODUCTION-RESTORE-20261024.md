# Luna6 生产恢复交接：iridescently.xyz HTTPS 防窜站 — 2026-10-24

结论：**READY FOR LUNA6 PRODUCTION HANDOFF**（附硬门禁：§4 stage 监听审计、§5.6 无 DNS 边缘门禁、§6 逐条 DNS 验收；任一失败即停止，按 §10 回滚）。

本文是唯一执行手册。逐项机械执行；每步有「期望」与「STOP」条件。所有命令在 Windows Git Bash 中运行，除非另注明。
`ZSZM-RECOVERY-20261024.md` 是 Codex 第一轮记录，候选与步骤以本文为准。

---

## 0. 一页摘要

| 项 | 值 |
|---|---|
| 分支 | `codex/security-ingress-20261024`（私有仓库 `iridescent1208234593-debug/Gate-of-All-Beings`） |
| 工作树 | `C:/Users/hp/.codex/worktrees/security-ingress-20261024/Projects` |
| 候选所用提交 | `db5ace8545394c562d2645d1945a25478256f2e7`（之后仅有文档提交） |
| **候选版本** | **`20261024T053655Z`** — 2,101 文件，211,590,586 bytes，SHA-256 `8e3cbd4d4573c148000209334065a0b3d6193e1d803df22401059f3b4222059d` |
| 候选位置 | `E:/Projects/.releases/hk-code-publish/20261024T053655Z.tar.gz`（+ `.json` 清单） |
| 基线（当前生产） | `20261023T184556Z`；候选 = 基线 2,093 个文件逐字节不变 + 8 个 overlay（3 个新增） |
| **不得激活** | `20261024T044733Z`（Codex 第一轮，已在 HK stage）：缺少会馆开放重定向修复与新门禁 |
| 恢复范围（已授权） | 仅 `iridescently.xyz`、`huiguan.iridescently.xyz`、`oc.iridescently.xyz`、`zszm.iridescently.xyz` |
| Zone / Account | `877486776bed7d0555c6c3b23eb9a454` / `7144e252e82ff7d91ca3019201697b11` |
| HK Tunnel | `6c9eb0eb-26d7-451c-9dbd-878e7c14f4a7`（zszm-hk-ecsvkdu0，健康，4 连接，均来自源站 IP） |
| 动态重定向规则集 | `509191bcd1944d14987fb4c5195f3670`（现有 1 条 www→apex，id `3ce6610766cb445a81523c23cf95efd4`） |
| 证据 | 第一轮 `E:/CloudflareEvidence/incident-20261024-20261024T041954Z/`；本轮 `E:/CloudflareEvidence/incident-20261024-claude-review-20261024T0540Z/`（`manifest.json` 含 SHA-256） |

8 个 overlay：`server/portal_server.py`、`server/base_static.py`、`server/access_recovery.py`、`server/host_policy.py`(新)、`server/allowed_hosts.json`(新)、`server/security_ingress_test.py`(新)、`server/verify_portal.py`、`portal/huiguan/index.html`。会馆页面相对生产只改 13 行（`next` 校验），其余文件与生产逐字节相同。

### 本轮发现与处置（摘要）

| 级别 | 问题 | 状态 |
|---|---|---|
| P1 | 会馆登录后 `?next=` 用正则 `^https://[\w.-]*iridescently\.xyz/` 校验，`https://evil-iridescently.xyz/` 等仿冒域名可通过 → 登录后开放重定向。**生产 `20261023T184556Z` 中存在。** | 已修复（精确主机名白名单 + URL 解析），浏览器实测；须先激活候选再恢复 huiguan DNS |
| P1 | 生产 nginx（`/etc/nginx/snippets/zszm-proxy.conf`）把 `X-Forwarded-Proto` 固定写 `https`，Python 源站的 HTTP→HTTPS 检查在生产栈中永远不触发；且 Cloudflare「Always Use HTTPS」关闭、尚无边缘规则 → 若直接恢复 DNS，HTTP 会返回完整页面 | 以 §5 边缘 308 规则为主控，§5.6 在恢复 DNS **之前**用固定边缘 IP 验证；nginx 纵深修复见 §7 |
| P2 | `normalize_host` 把 `Host: zszm.iridescently.xyz#` / `…?` 规范化为合法主机（urlsplit 空 fragment/query） | 已修复（Host 语法白名单）+ 回归 |
| P2 | 代理只剥离 Forwarded/X-Forwarded-Host/-Proto；`X-Original-Host`、`X-Forwarded-Server/Port/Prefix`、`X-Original-URL` 等原样转发上游 | 已修复（统一 `FORWARDING_HEADERS`，HTTP 与 WebSocket 代理均有红队回归）；当前无上游消费者 |
| P2 | stage 监听审计只看固定端口，且结果不出现在 stage 返回值 | 已修复：枚举全部 TCP 监听，非回环且应答 HTTP/TLS 即失败；摘要写入 stage 返回行 |
| P2 | HK tunnel 仍含已退役的 `hk-zszm-check.iridescently.xyz`（Host 覆盖为 zszm） | 无 DNS，当前不可达；§7.4 清理 |
| P3 | 括号 IPvFuture `[v1.x]` 被当主机名；端口 1–65535 均接受（nginx 只接受 80/443） | 已修复括号；端口仅影响规范化，Location 从不含端口，保留 |
| P3 | 非 zszm 主机及 API 代理错误仍为 Python 默认错误页；Server 头在生产被 nginx/Cloudflare 替换 | 不修（按要求不为此重写 server） |
| P3 | CSP：全站 Report-Only（含 `unsafe-inline`，且无 report-uri，违规无人收集）；zszm 强制 `base-uri 'self'; object-src 'none'` | 已知技术债，本轮不扩大 |
| P3 | 友链 `love4z.cn` 现为 “Hello World” 占位页，`xiaoheiwo.cn` 返回 421 | 交站长核对友链 |

---

## 1. 权限与边界

Luna6 需要：

1. HK 受限发布密钥：`E:/Projects/.releases/hk-full-migration/deploy_ed25519`（强制命令，只能 status/stage/activate/rollback）。通过 `E:/Projects/ops/hk-release.py` 的 `remote()` 调用。
2. Cloudflare API token（放环境变量 `CF_API_TOKEN`，**不得写入任何文件或日志**），权限：Zone Settings Edit、Single Redirect/Dynamic Redirect Edit、Transform Rules Edit、DNS Edit、Zone Read、Account Cloudflare Tunnel Read。或在已登录的控制台按每步「控制台」做法执行。
3. 仅 §7（nginx / cloudflared）需要 HK root（过去由站长交互输入 root 密码，见 `work/hk-bandwidth/ssh_session.py`）。§7 不是恢复 4 个主机名的前置条件，但在恢复任何**其他**主机名之前、且最迟 7 天内必须完成。

禁止：`git -c http.sslVerify=false` 或任何关闭 TLS 校验；Flexible SSL / `noTLSVerify`；对重定向规则集整体 PUT；开启 HSTS `includeSubDomains` / `preload`；本窗口启用 DNSSEC；恢复授权范围外的任何 DNS（www、spirit、game、juling、lingjing、pc-*、hk-zszm-check、origin-zszm、backup、feather、psy、psyche）；删除隧道或证据；激活 `20261024T044733Z`。

通用环境变量（每个新 shell 先执行）：

```bash
export CF=https://api.cloudflare.com/client/v4
export ZONE=877486776bed7d0555c6c3b23eb9a454
export ACCOUNT=7144e252e82ff7d91ca3019201697b11
export RS_REDIRECT=509191bcd1944d14987fb4c5195f3670
export TUNNEL=6c9eb0eb-26d7-451c-9dbd-878e7c14f4a7
export CAND=20261024T053655Z
export WT=C:/Users/hp/.codex/worktrees/security-ingress-20261024/Projects
export LOG=E:/CloudflareEvidence/restore-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$LOG"
cfget(){ curl -sS -H "Authorization: Bearer $CF_API_TOKEN" "$CF$1"; }
```

`$LOG` 为本次上线的新证据目录；所有输出写入其中，不覆盖已有证据。

---

## 2. Preflight（全部 PASS 才继续）

| # | 命令 | 期望 | STOP |
|---|---|---|---|
| P1 | `cd "$WT" && git status --short && git rev-parse HEAD && git log --oneline -1 db5ace8` | 工作树干净；`db5ace8` 存在且是 HEAD 的祖先 | 有未提交改动或缺提交 |
| P2 | `cd "$WT" && git diff --stat db5ace8 HEAD -- server portal shared` | 无输出（之后只改文档） | 有代码差异 → 需重建候选 |
| P3 | `sha256sum E:/Projects/.releases/hk-code-publish/$CAND.tar.gz` | `8e3cbd4d4573c148000209334065a0b3d6193e1d803df22401059f3b4222059d` | 不符 |
| P4 | 复现构建（见下） | 复现 SHA-256 与 P3 相同 | 不同 |
| P5 | HK 状态（见下） | `current=20261023T184556Z`，5 服务 `active` | current 不同 → STOP，按 §2.1 重建 |
| P6 | `cfget /zones/$ZONE/dns_records > "$LOG/dns-before.json"` | 只有 `assets.iridescently.xyz → public.r2.dev` 1 条 | 出现其他记录 |
| P7 | `cfget /zones/$ZONE/rulesets/$RS_REDIRECT > "$LOG/redirect-before.json"` | 只有 www→apex 1 条 | 规则数或内容不同 → 先人工核对 |
| P8 | `cfget /zones/$ZONE/rulesets/phases/http_response_headers_transform/entrypoint > "$LOG/headers-before.json"` | `10003 could not find entrypoint`（404） | 已存在 → §5.3 改走 POST 分支 |
| P9 | `for s in ssl ssl_automatic_mode always_use_https min_tls_version; do cfget /zones/$ZONE/settings/$s; echo; done > "$LOG/settings-before.json"` | `full` / `auto` / `off` / `1.0` | 不同 → 记录并人工核对后继续 |
| P10 | `cfget "/accounts/$ACCOUNT/cfd_tunnel/$TUNNEL" > "$LOG/tunnel-before.json"` | `status: healthy`，连接 `origin_ip` 均为源站 | 非 healthy |
| P11 | `cd "$WT" && python -X utf8 server/security_ingress_test.py` | 输出 `PASS: existing chooser…sixteen`、`PASS: Huiguan login next rejects 25…`、`PASS: 154 …checks` | 任一失败 |

P4 复现（不覆盖正式候选，写到临时目录）：

```bash
cd "$WT" && python -X utf8 ops/security/build_overlay_candidate.py \
  --releases E:/Projects/.releases/hk-code-publish --output "$LOG" \
  --base 20261023T184556Z --overlay-list ops/security/candidate-overlays.json \
  --ref db5ace8545394c562d2645d1945a25478256f2e7 --version $CAND --compare 20261024T044733Z \
  > "$LOG/candidate-repro.json"
python -c "import json;d=json.load(open(r'$LOG/candidate-repro.json'));print(d['summary']['sha256'], d['untouched_base_files'], d['compare']['differences_ignoring_crlf'])"
rm -f "$LOG/$CAND.tar.gz"   # 只保留 json 记录
```

期望：`8e3cbd4d…059d 2093 ['portal/huiguan/index.html', 'server/host_policy.py', 'server/portal_server.py', 'server/security_ingress_test.py', 'server/verify_portal.py']`。

P5 HK 状态（后文 `hk()` 复用）：

```bash
hk(){ cd E:/Projects && python -X utf8 - "$@" <<'EOF'
import importlib.util, json, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location('hk', 'ops/hk-release.py'); hk = importlib.util.module_from_spec(spec); spec.loader.exec_module(hk)
command, archive = sys.argv[1], (Path(sys.argv[2]) if len(sys.argv) > 2 else None)
print(json.dumps(hk.remote(command, archive), ensure_ascii=False, indent=1))
EOF
}
hk status | tee "$LOG/hk-status-before.json"
```

### 2.1 若 HK current 已不是 `20261023T184556Z`

STOP。先确认新 current 的来源与内容（另一会话发布？），把它作为新基线：确保本地有 `<新版本>.tar.gz/.json`，然后用同一构建器 `--base <新版本>` 重新构建，重新做 P3/P4（新 SHA）与 §4。不要把旧候选叠在新基线上。

---

## 3. 安全 push

本分支已由 Claude 推送（见交付报告的 Git 状态）。Luna6 只需核对：

```bash
cd "$WT" && git config --get http.sslVerify; git config --show-origin --get-regexp 'http\..*'
git fetch origin codex/security-ingress-20261024 && git rev-parse HEAD origin/codex/security-ingress-20261024
```

期望：`http.sslVerify` 无输出或为 `true`；两个 SHA 相同。若尚未推送或不同：

```bash
git push origin codex/security-ingress-20261024      # 不加 --force，不改 TLS 设置
```

TLS 失败时：只允许重试或换网络（例如开/关本机 Mihomo），并用 `curl -sv https://github.com -o /dev/null 2>&1 | grep -i issuer` 确认证书由公共 CA 签发给 github.com；若 issuer 是代理/未知 CA → 疑似中间人，停止推送并上报。**严禁** `sslVerify=false`。push 不是上线前置条件：候选归档已按提交构建并可复现。

---

## 4. 部署代码（stage → activate）

DNS 仍然撤下，此时激活对公众无影响。

```bash
hk "stage $CAND" E:/Projects/.releases/hk-code-publish/$CAND.tar.gz | tee "$LOG/stage.json"
```

期望（全部满足）：

- `"staged": "20261024T053655Z"`，`"archive_bytes": 211590586`。
- `validation` 唯一一行以 `68/68 passed; origin listeners: ` 开头。
- `origin listeners:` 后**不是** `not audited`；格式 `N listening, non-loopback <地址:端口/协议>,…`。每个非回环项协议只能是 `ssh`（预期仅 `0.0.0.0:43012/ssh` 与 `[::]:43012/ssh`）。`other`（不应答 HTTP/TLS 的未知服务）记录到 `$LOG` 并在 §11 跟进，不阻塞。

STOP：stage 抛错（含 `protected port bound beyond loopback` 或 `non-loopback listener answers HTTP/TLS`）。此时**不得激活**。用 root 在 HK 执行 `ss -ltnp` 找到进程：不需要就停掉，需要就改为只监听 127.0.0.1；然后用**新版本号**重新构建并 stage（同名版本会被拒绝）。不得为通过门禁而改测试。

```bash
hk "activate $CAND" | tee "$LOG/activate.json"
hk status | tee "$LOG/hk-status-after-activate.json"
```

期望：`current=20261024T053655Z`，`previous=20261023T184556Z`，5 个服务 `active`。激活失败时控制命令会自动回到旧版本；记录输出后 STOP。

---

## 5. Cloudflare 配置（先于任何 DNS 恢复）

### 5.1 记录变更前状态

已在 P6–P10 完成；保留 `$LOG/*-before.json`。

### 5.2 HTTP→HTTPS 边缘 308（追加，不覆盖）

```bash
cd "$WT"
curl -sS -X POST -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  "$CF/zones/$ZONE/rulesets/$RS_REDIRECT/rules" --data @ops/security/zszm-http-redirect.json \
  | tee "$LOG/redirect-after.json" | python -c "import json,sys;r=json.load(sys.stdin)['result'];[print(x['id'],x['description'],x['action_parameters']['from_value']['status_code']) for x in r['rules']]"
```

期望：2 条规则；第 1 条仍是 `3ce6610766cb445a81523c23cf95efd4 www → apex 301`；第 2 条 `ZSZM and required dependencies: HTTP to HTTPS 308`。把第 2 条 id 记为 `RULE_REDIRECT`。
控制台：Rules → Redirect Rules → Create → 自定义表达式，粘贴 `ops/security/zszm-http-redirect.json` 的 `expression`；动态目标 `concat("https://", http.host, http.request.uri.path)`，308，保留查询字符串；放在 www→apex 之后。

规则只覆盖 4 个授权主机。已实测 Cloudflare 在匹配前规范化 `http.host`（端口、大小写、尾点都不影响现有 www 规则命中，见证据 `edge-host-normalization.json`），带端口/大写的 Host 无法绕过。**不要**开启 Zone 级 Always Use HTTPS：那会把未知子域也 301，而本项目要求未知名称直接拒绝。

### 5.3 响应头（HSTS + zszm 强制 CSP）

P8 为 404（预期）时，创建入口规则集，包含 2 条：

```bash
cd "$WT" && python -c "import json;print(json.dumps({'rules':[json.load(open('ops/security/zszm-edge-headers.json')),json.load(open('ops/security/restored-edge-hsts.json'))]}))" > "$LOG/headers-body.json"
curl -sS -X PUT -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  "$CF/zones/$ZONE/rulesets/phases/http_response_headers_transform/entrypoint" --data @"$LOG/headers-body.json" \
  | tee "$LOG/headers-after.json" | python -c "import json,sys;r=json.load(sys.stdin)['result'];print('RS_HEADERS',r['id']);[print(x['id'],x['description']) for x in r['rules']]"
```

若 P8 显示入口已存在：**不要 PUT**，对返回的 id 分别 `POST $CF/zones/$ZONE/rulesets/<id>/rules --data @ops/security/zszm-edge-headers.json` 与 `--data @ops/security/restored-edge-hsts.json`。
记录 `RS_HEADERS` 与两条规则 id。控制台：Rules → Transform Rules → Modify Response Header，按两个 JSON 文件各建一条。

### 5.4 SSL/TLS → Full (strict)

```bash
for body in '{"value":"custom"}:ssl_automatic_mode' '{"value":"strict"}:ssl'; do
  curl -sS -X PATCH -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
    "$CF/zones/$ZONE/settings/${body##*:}" --data "${body%:*}"; echo; done | tee "$LOG/ssl-after.json"
cfget /zones/$ZONE/settings/ssl; echo; cfget /zones/$ZONE/settings/ssl_automatic_mode
```

期望：`ssl=strict`，`ssl_automatic_mode=custom`。控制台：SSL/TLS → Overview → Configure → Custom SSL/TLS → Full (strict)。
影响：Zone 级。HK/PC 都经 Tunnel，Tunnel 不受加密模式影响；`assets.iridescently.xyz` 是 Cloudflare 管理的 R2，自带有效证书。验证：`curl -s -o /dev/null -w '%{http_code}\n' https://assets.iridescently.xyz/` 不得为 525/526。

### 5.5 可选（推荐，不阻塞）：最低 TLS 1.2

`PATCH $CF/zones/$ZONE/settings/min_tls_version --data '{"value":"1.2"}'`。只影响 Android 4.x 等极旧客户端。回滚改回 `"1.0"`。

### 5.6 硬门禁：恢复 DNS 之前，用固定边缘 IP 验证

DNS 为空时，Zone 规则仍在边缘生效（今日实测：www 规则在无 DNS 时照常 301）。

```bash
cd "$WT" && python -X utf8 server/security_ingress_test.py --public --edge-ip 104.21.6.184 --output "$LOG/pre-dns-gate.json"; echo exit=$?
```

期望：`exit=0`、`"ok": true`。脚本对 4 个主机 × 8 条路径断言 HTTP 第一跳 = 301/308 到 `https://<同主机><同路径+查询>` 且响应体 < 2 KB；并断言反例：SNI=zszm/Host=evil → 4xx；SNI=evil → TLS 握手失败；未登记子域 → 530；未知 Host 的 HTTP → ≥400 且无 Location。
今日在加规则**之前**运行同一命令，正确失败：`('zszm.iridescently.xyz', '104.21.6.184', '/', 530, 'edge HTTP->HTTPS rule missing?')`（证据 `pre-dns-edge-gate-before-cloudflare-changes.json`）。
STOP：任何失败。若 104.21.6.184 不可达，可换 `cfget /zones/$ZONE` 之外任意 Cloudflare 边缘地址（脚本会校验地址属于 Cloudflare）。

---

## 6. DNS 恢复（逐条，依赖顺序）

顺序：`iridescently.xyz` → `huiguan.iridescently.xyz` → `oc.iridescently.xyz` → `zszm.iridescently.xyz`。
（apex 提供 `shared/` 与站点导航，会馆提供账户，zszm 依赖前两者。）**huiguan 必须在 §4 激活成功之后恢复**（开放重定向修复）。

每条执行：

```bash
H=iridescently.xyz   # 依次替换
curl -sS -X POST -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$CF/zones/$ZONE/dns_records" \
  --data "{\"type\":\"CNAME\",\"name\":\"$H\",\"content\":\"$TUNNEL.cfargotunnel.com\",\"proxied\":true,\"ttl\":1,\"comment\":\"2026-10-24 incident restore\"}" \
  | tee "$LOG/dns-create-$H.json" | python -c "import json,sys;r=json.load(sys.stdin);print(r['success'],r['result']['id'],r['result']['name'],r['result']['proxied'])"
```

记录 record id（回滚只删这些 id）。然后等待解析（通常 < 1 分钟）：

```bash
for r in https://cloudflare-dns.com/dns-query https://dns.google/resolve; do curl -s -H 'accept: application/dns-json' "$r?name=$H&type=A"; echo; done
cd "$WT" && python -X utf8 server/security_ingress_test.py --public --hosts $H --output "$LOG/public-$H.json"; echo exit=$?
```

期望：两家 DoH `Status: 0` 且只有 Cloudflare 地址；脚本 `exit=0`。脚本对该主机检查：HTTP 第一跳；HTTPS 正常页面（证书链与主机名由系统 CA 校验）；所有 Location 只指向已登记主机且无循环；HSTS（zszm `max-age=2592000`，其余 ≥ 86400，且**不得**含 includeSubDomains/preload）；zszm 有强制 CSP；zszm 的 `/__server/select` 含已审查的 return 过滤；以及全部 SNI/Host 反例。
STOP：失败 → 立即删除本条记录（§10.1），排查后再试。4 条全部通过后，再整体跑一次：`python -X utf8 server/security_ingress_test.py --public --output "$LOG/public-all.json"`。

---

## 7. 源站纵深修复（需要 HK root；DNS 恢复并稳定 30 分钟后执行）

目的：让源站自身也拒绝未知 Host、把访客 HTTP 重定向，不再依赖单一边缘规则；清除残留测试入口。生成文件均在 `ops/security/generated/`（由 `ops/security/render_ingress.py` 从 `server/allowed_hosts.json` 生成）。

### 7.1 备份与核对

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ); mkdir -p /root/nginx-backup-$TS
cp -a /etc/nginx/conf.d /etc/nginx/snippets /root/nginx-backup-$TS/
cp -a /etc/cloudflared/zszm-hk.yml /root/nginx-backup-$TS/
nginx -T > /root/nginx-backup-$TS/nginx-T.txt 2>&1
grep -c '^proxy_set_header X-Forwarded-Proto https;$' /etc/nginx/snippets/zszm-proxy.conf   # 期望 1
grep -n 'listen' /etc/nginx/conf.d/*.conf /etc/nginx/sites-enabled/* 2>/dev/null           # 期望只有 127.0.0.1:8080
```

STOP：计数不是 1，或出现非 127.0.0.1 的 listen → 与已审查拓扑不符，上报，不要改。

### 7.2 安装

把 `generated/host-map.conf`、`origin-default.conf`、`proxy-forwarding.conf`、`origin-guards.conf` 原样上传到 HK（内容见仓库），然后：

```bash
install -m 644 host-map.conf        /etc/nginx/conf.d/00-iridescently-host-map.conf
install -m 644 origin-default.conf  /etc/nginx/conf.d/01-iridescently-default.conf
install -m 644 proxy-forwarding.conf /etc/nginx/snippets/iridescently-forwarding.conf
install -m 644 origin-guards.conf   /etc/nginx/snippets/iridescently-origin-guards.conf
sed -i 's/^proxy_set_header X-Forwarded-Proto https;$/proxy_set_header X-Forwarded-Proto $iridescently_visitor_proto;/' /etc/nginx/snippets/zszm-proxy.conf
echo 'include /etc/nginx/snippets/iridescently-forwarding.conf;' >> /etc/nginx/snippets/zszm-proxy.conf
sed -i '0,/^    server_tokens off;$/s//    server_tokens off;\n    include \/etc\/nginx\/snippets\/iridescently-origin-guards.conf;/' /etc/nginx/conf.d/zszm.conf
grep -c 'X-Forwarded-Proto' /etc/nginx/snippets/zszm-proxy.conf                       # 期望 1（只剩访客值那一行）
grep -c 'iridescently-origin-guards.conf' /etc/nginx/conf.d/zszm.conf                 # 期望 1
nginx -t && systemctl reload nginx
```

`X-Forwarded-Proto` 必须只有一行：两行会让 Python 收到两个值并对所有请求 308 循环。`nginx -t` 失败 → 不 reload，按 §10.4 恢复。

### 7.3 验证（HK 本机 + 公网）

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: evil.example' http://127.0.0.1:8080/                                    # 000（444 断开）
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'Host: zszm.iridescently.xyz' 'http://127.0.0.1:8080/a?b=1'      # 308 https://zszm.iridescently.xyz/a?b=1
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: zszm.iridescently.xyz' -H 'X-Forwarded-Proto: https' http://127.0.0.1:8080/__server/status   # 200
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: evil.example' -H 'X-Forwarded-Proto: https' http://127.0.0.1:8080/__server/select             # 000
nginx -T 2>/dev/null | grep -c 'X-Forwarded-Proto https;'                                                                   # 0
```

然后在 Windows 重跑 `--public --output "$LOG/public-after-nginx.json"`，期望 `ok: true`。出现 “redirect loop” → 说明 cloudflared 没有转发访客 `X-Forwarded-Proto`：立即 §10.4 恢复，上报。

### 7.4 清理退役 Tunnel 入口（低峰执行）

从 `/etc/cloudflared/zszm-hk.yml` 删除 `hk-zszm-check.iridescently.xyz` 整条（含 `originRequest: httpHostHeader`），然后：

```bash
cloudflared tunnel ingress validate --config /etc/cloudflared/zszm-hk.yml
cloudflared tunnel --config /etc/cloudflared/zszm-hk.yml ingress rule https://hk-zszm-check.iridescently.xyz   # 期望命中最后的 http_status:404
systemctl restart cloudflared-zszm && sleep 20 && systemctl is-active cloudflared-zszm
```

再用 `cfget /accounts/$ACCOUNT/cfd_tunnel/$TUNNEL` 确认 `healthy` 且有连接，重跑公网检查。旧 tunnel `main`(4c3072da…)、`backup-hk`(b777559c…) 当前 down，作为证据保留；事故结案后另行删除。

---

## 8. 上线后验证矩阵

| ID | 检查 | 方法 | PASS | 当前状态 |
|---|---|---|---|---|
| V01 | 4 主机 HTTP 第一跳 308 同主机，保持 path/query，无正文 | §5.6 / §6 脚本 | 全部 301/308、Location 精确、正文 < 2 KB | 本地 Python 层 PASS；边缘 **待 §5.2** |
| V02 | 未知子域 HTTP/HTTPS | 脚本 | ≥400、无 Location、无业务页 | 边缘今日 PASS（530） |
| V03 | 非本 Zone Host 打到 Cloudflare | 脚本 | ≥400、无 Location | 今日 PASS（409/403） |
| V04 | 正确 SNI + 错误 Host | 脚本 | 403/4xx | 今日 PASS（403） |
| V05 | 错误 SNI + 正确 Host | 脚本 | TLS 握手失败 | 今日 PASS（handshake_failure） |
| V06 | 错误 SNI + 错误 Host | 脚本 | TLS 握手失败 | 今日 PASS |
| V07 | 正确 SNI + 正确 Host | 脚本（DNS 后） | 200 业务页，证书链/主机名校验通过 | 待 DNS |
| V08 | HSTS 阶段值 | 脚本 | zszm 2592000；其余 ≥ 86400；无 includeSubDomains/preload | 待 §5.3 + DNS |
| V09 | zszm 强制 CSP + Report-Only 并存 | `curl -sI https://zszm.iridescently.xyz/ \| grep -i content-security` | 两个头都在 | 待 DNS |
| V10 | 重定向链只到已登记主机、无循环 | 脚本 | 通过 | 待 DNS |
| V11 | 选服 `return` 过滤 | 脚本断言过滤行 + 浏览器打开 `/__server/select?return=%2F%2Fevil.example`，两个按钮均指向本站 | 不出现外域 | 本地 16 载荷 PASS |
| V12 | 会馆 `next` 修复已上线 | `curl -s https://huiguan.iridescently.xyz/ \| grep -c 'function safeAuthNext'`；浏览器打开 `/?openauth=1&next=https%3A%2F%2Fevil-iridescently.xyz%2F`，控制台 `window.__AUTH_NEXT === ''` | 1；空串 | 本地浏览器 PASS |
| V13 | 伪造转发头不影响 | `curl -s -H 'X-Forwarded-Host: evil.example' -H 'Forwarded: host=evil.example' -H 'X-Original-Host: evil.example' https://zszm.iridescently.xyz/__server/status`；`curl -sI -H 'X-Forwarded-Host: evil.example' 'http://zszm.iridescently.xyz/x?y=1'` | 200 正常 JSON；Location 为 `https://zszm.iridescently.xyz/x?y=1` | 本地 PASS（HTTP + WS 代理红队） |
| V14 | DNS 只解析到 Cloudflare | 脚本 DoH 两家 A/AAAA | 全在 Cloudflare 段 | 待 DNS |
| V15 | 源站监听审计 | §4 stage 返回行 | 非回环只有 ssh | 待 stage |
| V16 | 错误页无 Python 指纹 | `curl -s https://zszm.iridescently.xyz/definitely-missing.js \| grep -c -E 'Python\|BaseHTTP\|Error code explanation'`；`curl -sI … \| grep -i ^server` | 0；`server: cloudflare` | 本地 PASS |
| V17 | 服务与 Tunnel | `hk status`；`cfget …/cfd_tunnel/$TUNNEL` | 候选为 current，5 服务 active；healthy | 待 §4 |
| V18 | 真实浏览器验收 | 桌面 + 安卓：会馆登录/退出、门庭、zszm 进入游戏、模块导航、存档同步、`/app/shell/` | 功能正常；控制台无报错（CSP Report-Only 报告除外） | 待 DNS |
| V19 | 两独立网络 | §9 | 两次 `ok: true` 且 `egress.ip` 不同 | **REQUIRES POST-DEPLOY EXTERNAL VALIDATION** |
| V20 | 无协议输入（事故路径） | 安卓夸克/系统浏览器直接输入 `zszm.iridescently.xyz`（不带 https） | 地址栏落在 `https://zszm.iridescently.xyz/`，证书有效，历史中无第三方域名 | 待 DNS |
| V21 | §7 后源站自检 | §7.3 | 全部符合 | 待 §7 |

监控（恢复后 24 小时）：Cloudflare Analytics 按主机看 3xx/4xx/5xx 比例；HK 上 `journalctl -u iridescently-portal --since -1h | grep -c host_rejected`（经边缘不应有 Host 拒绝；持续增长说明有绕过尝试）；`/var/log/nginx/zszm-error.log`。注意 `zszm` 的 nginx `log_format` 不记录 Host 与查询串（隐私友好，但取证受限，见 §11）。

---

## 9. 两独立网络外部验证 — REQUIRES POST-DEPLOY EXTERNAL VALIDATION

本轮无法完成：DNS 未恢复，正向检查无法执行；且本机全部流量经 Mihomo（Clash Verge）TUN 出口 AWS 新加坡（`13.214.167.62` / `2406:da18:671:3000:…`），只构成一个网络。两个 DoH 解析器不等于两个网络。

DNS 全部恢复并通过 §6 后执行：

1. 网络 A：本机现状（Mihomo 开）——`python -X utf8 server/security_ingress_test.py --public --output "$LOG/netA.json"`。
2. 网络 B：不同出口，任选其一：本机关闭 Mihomo 走本地宽带；手机热点（中国大陆移动网络，最接近事故现场）；另一台不同运营商/云厂商的机器 checkout 本分支运行同一命令。输出 `"$LOG/netB.json"`。
3. 比较：`python -c "import json;a,b=[json.load(open(p)) for p in ('$LOG/netA.json','$LOG/netB.json')];print(a['ok'],b['ok'],a['egress'],b['egress'])"`。

PASS：两次 `ok: true`，`egress.ip` 不同（最好 `loc` 也不同）。FAIL：任一 `ok: false` → 看 `error` 字段，按 §10 处理；`egress.ip` 相同 → 不算第二网络，重做。
另做 V20：在中国大陆移动网络的安卓手机上手动验证。

---

## 10. 回滚

触发条件：任一 STOP；公网出现指向非登记主机的跳转；证书错误；HTTP 返回完整页面；重定向循环；登录/存档失效；5xx 持续 > 5 分钟。

### 10.1 DNS（最快的止损）

```bash
curl -sS -X DELETE -H "Authorization: Bearer $CF_API_TOKEN" "$CF/zones/$ZONE/dns_records/<本次创建的 record id>"
```

只删 §6 记录的 id；不得触碰 `assets.iridescently.xyz`。DNS 缓存可能延迟生效，边缘 HTTPS/Host 防护保持开启。

### 10.2 代码

```bash
hk status    # 确认 current 正是 20261024T053655Z
hk rollback  # 回到 previous = 20261023T184556Z
hk status
```

**注意**：`20261023T184556Z`（以及 `20261024T044733Z`）仍含会馆开放重定向。代码回滚后，`huiguan.iridescently.xyz` 的 DNS 必须同时删除（§10.1），直到重新激活含修复的版本。

### 10.3 Cloudflare 规则与设置

```bash
curl -sS -X DELETE -H "Authorization: Bearer $CF_API_TOKEN" "$CF/zones/$ZONE/rulesets/$RS_REDIRECT/rules/<RULE_REDIRECT>"
curl -sS -X DELETE -H "Authorization: Bearer $CF_API_TOKEN" "$CF/zones/$ZONE/rulesets/<RS_HEADERS>/rules/<每条 id>"
curl -sS -X PATCH  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$CF/zones/$ZONE/settings/ssl" --data '{"value":"full"}'
curl -sS -X PATCH  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$CF/zones/$ZONE/settings/ssl_automatic_mode" --data '{"value":"auto"}'
```

只删本次创建的规则 id，不对规则集整体 PUT；www→apex（`3ce6610766cb445a81523c23cf95efd4`）与会馆原图封锁规则保持不动。HTTP→HTTPS 规则是主防线：仅在它本身是故障原因时才删除，且同时撤下 DNS。

### 10.4 nginx / cloudflared（§7）

```bash
cp -a /root/nginx-backup-$TS/conf.d/. /etc/nginx/conf.d/ && cp -a /root/nginx-backup-$TS/snippets/. /etc/nginx/snippets/
rm -f /etc/nginx/conf.d/00-iridescently-host-map.conf /etc/nginx/conf.d/01-iridescently-default.conf \
      /etc/nginx/snippets/iridescently-forwarding.conf /etc/nginx/snippets/iridescently-origin-guards.conf
nginx -t && systemctl reload nginx
cp -a /root/nginx-backup-$TS/zszm-hk.yml /etc/cloudflared/zszm-hk.yml && systemctl restart cloudflared-zszm   # 仅当改过 §7.4
```

不得删除审计、失败包、日志或历史证据；HK 上已 stage 的 `20261024T044733Z` 保留不激活。

---

## 11. 阶段策略与遗留事项

**HSTS**（现阶段不做 includeSubDomains / preload）：

- 现在：zszm `max-age=2592000`（源站 + 边缘），apex/huiguan/oc `max-age=86400`（源站 + 边缘）；Zone 级 HSTS 设置保持关闭。
- 稳定 14 天且无 HTTPS 问题：把 4 个主机提到 `15552000`（同时改 `server/base_static.py` 与两条边缘规则）。
- includeSubDomains：只有在所有会解析的 `*.iridescently.xyz`（含 `assets` R2、`pc-*`、未来子域）都 HTTPS-only 且被重定向覆盖后，单独决策。preload 晚于此，单独决策。

**DNSSEC**：本窗口不启用。DNS 稳定 ≥ 72 小时后单独变更：Cloudflare 启用 → 取真实 DS → 在注册商阿里云（HiChina）提交 → 用两个验证型解析器确认 `AD=true`。回滚顺序相反：先在注册商删 DS，等待 DS TTL，再在 Cloudflare 关闭。

**CSP**：保持现状（zszm 强制 `base-uri 'self'; object-src 'none'`，全站完整策略 Report-Only，含 `unsafe-inline`）。下一步先加 `report-to` 收集真实违规，再逐模块收紧；不要为本次上线重构前端。

**其他主机名**（www、spirit、game、juling、lingjing、pc-*）：恢复前须先加入 §5.2 重定向规则表达式（或单独规则）并通过同样门禁；`pc-*` 还要求本机 PC 网关运行本分支代码（当前 PC 网关从 `E:/Projects` 主工作区运行，没有 Host 白名单）。

**遗留（不阻塞本次恢复）**：

- P2：§7 源站纵深修复，最迟 7 天内。
- P3：nginx `log_format zszm` 加 `$host`（不要加 `$args`/`$request_uri`，避免记录令牌），便于今后取证。
- P3：非 zszm 主机与 API 代理的 Python 默认错误页。
- P3：会馆站长专用原图接口对远程图片 302 到数据库中的任意 http(s) 地址（需站长登录，非公开开放重定向），可改为白名单图床。
- P3：AEON 页 `canonical/og:url` 指向原作者的 GitHub Pages（只影响搜索归属，非跳转）。
- P3：友链 `love4z.cn` 为 “Hello World” 占位页、`xiaoheiwo.cn` 返回 421，请站长核对。

**根因（仍未证实）**：历史异常证书与色情跳转目前没有直接证据。与现有证据相符、但都未证实的假设：

1. HTTP 明文入口：事故前 Always Use HTTPS 关闭，且 nginx 固定 `X-Forwarded-Proto https` 使源站从不重定向，所以无协议输入经 HTTP 时会拿到完整明文页面，在移动网络/公共 Wi-Fi 上可被劫持注入。本次 §5 + HSTS 正面消除该路径。
2. 夸克搜索结果或仿冒域名（截图有 02:41–02:42 搜索记录）——不在本站基础设施内。
3. 会馆 `next` 开放重定向被构造链接利用——需要用户完成登录；已修复。
4. 友链站点被劫持——今日首跳未见跳转（单一出口，不能排除按地域/UA 的劫持）。

补证途径：用户手机导出该历史条目的完整 URL 与时间、证书详情（若浏览器保留）；HK `/var/log/nginx/zszm-access.log` 在 2026-10-23T18:30–19:30Z 的记录（只有方法/路径/状态，无 Host）；Cloudflare Audit v2 完整七天分页。

---

## 12. 本轮实际验证结果（2026-10-24，Claude 会话）

| 测试 | 结果 |
|---|---|
| `server/security_ingress_test.py`（本地，完整） | PASS：154 项 HTTP/Host/转发/错误页/keep-alive（Codex 120 + 新增 34）；选服 16 载荷；会馆 `next` 拒绝 25 / 保留 5 |
| 候选解包后 `server/verify_portal.py`（即 HK stage 门禁） | PASS：68/68；监听审计在 Windows 上为 `not audited (not the HK runtime)`，需 HK stage 实测 |
| `server/test_stage183_release.py`（Cards 4 项） | PASS |
| `server/test_connection_reset_loop.py` | PASS 8/8 |
| `test_account_progress` / `test_game_save_scope` / `test_site_admin` / `test_gallery_interactions` | PASS 16 / 10 / 7 / 5（共 38） |
| `server/test_static_security.py`、`ops/test_access_recovery.py`、`ops/test_server_management.py`、`portal/huiguan/tests/test_archives.py` | PASS |
| 会馆页内联脚本语法（候选 CRLF 版，6 段） | PASS，0 错误 |
| 真实 Chrome（无头）打开候选会馆页 | 3 个恶意 `next` → `''`，合法 `next` 保留，0 页面错误 |
| Python 字节编译（全部改动文件） | PASS |
| TypeScript / 前端构建 | SKIP：未改动任何 TS/模块源码；候选内构建产物与生产逐字节相同 |
| 候选可复现构建 | PASS：两次构建 SHA-256 相同 |
| 边缘反例（固定 104.21.6.184，无 DNS） | PASS：403 / 握手失败 ×2 / 530 / 未知 Host HTTP 409·530 无 Location |
| 边缘 HTTP→HTTPS（无 DNS 门禁） | FAIL（预期）：规则尚未配置，zszm HTTP 返回 530 |
| 源站直连探测 | INCONCLUSIVE：本机 TUN 对所有端口本地完成握手；仅 43012 返回真实 OpenSSH 横幅（证明路径可达）。不计为 PASS |
| Cloudflare 只读快照 | 已存证：ssl=full(auto)、Always Use HTTPS=off、min TLS 1.0、HSTS 关、仅 www→apex 重定向与会馆原图封锁、无 Page Rules / Workers 路由 / Bulk Redirect / 响应头规则、DNS 仅 assets、DNSSEC disabled、4 个 tunnel 配置与 12:20 快照一致 |

源站直连结论（证据链）：Tunnel 全部服务目标为 `http://127.0.0.1:*`，fallback `http_status:404`，无通配（API 实时读取）；HK 连接器从源站 IP 主动外连；Codex 在 04:47Z stage 时的内核监听审计确认 80/443/4173/5174/5177/5178/8080/18180/18190 均未绑定非回环地址；新候选的 stage 会枚举全部 TCP 监听，任何非回环且应答 HTTP/TLS 的服务都会让 stage 失败（§4 硬门禁）。外网超时**不**作为证据。
