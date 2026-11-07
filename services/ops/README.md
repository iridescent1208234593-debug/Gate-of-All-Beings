# services/ops — 三节点只读运维（Agent + Hub）

完整设计、端口、安全审查与部署步骤见 [docs/three-node-ops.md](../../docs/three-node-ops.md)。

| 模块 | 作用 |
| --- | --- |
| `opsnode/agent.py` | 每个节点一个，只绑 127.0.0.1:18410；`GET /v1/health`、`GET /v1/status`（Bearer 令牌，回包带 HMAC 签名） |
| `opsnode/hub.py` | B 上的汇总 API，127.0.0.1:18420；`/v1/summary`、`/v1/nodes/<name>`、`/v1/alerts`、`/v1/frps` |
| `opsnode/cli.py` | 终端视图：`python -m opsnode.cli --token-file <file> summary` |
| `opsnode/system.py` / `probes.py` | 只读采集；只用标准库，有 psutil 时用 psutil |
| `opsnode/lab.py` | LAB V2：supervisor.json、`/healthz`、monitor 角色的 `/api/monitor` |
| `opsnode/hkrelease.py` | 香港 Release 状态：普通用户读 channel 文件，不调用 `iridescently-control`、不用 sudo |
| `opsnode/alerts.py` | 告警规则（纯函数） |
| `opsnode/supervise.py` | C 上管 frpc 与 agent 的有界重启监督进程（策略同 LAB supervisor） |
| `config/*.example.json` | 三个节点的 agent 配置与 hub 配置样例；真实配置放 `secrets/`，不进 Git |

第一阶段只读：没有任何写接口，也没有“执行命令”的探针。重启、发布、回滚、恢复属于后续单独授权的阶段，入口仍是服务器管家。

测试：`python -X utf8 services/ops/tests/test_ops.py`（已加入 `tools/checks/regression.py`）。
