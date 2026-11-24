# 会馆账户免配对码登录（Web）
本候选不部署、不删除玩家或测试码。Windows、Android 的免码登录不属于本改动。

## 部署、验证和回退
先把 Hall 和 LAB 代码部署为关闭状态。Hall 保持 IRIDESCENTLY_LAB_ACCOUNT_DIRECT_WEB 和 IRIDESCENTLY_LAB_ACCOUNT_DIRECT_WEB_DEFAULT_ALL 关闭；LAB 保持 account_direct_web_enabled=false、admission_max_waiters=0、admission_legacy_players=false、player_test_codes_enabled=true。新增 SQLite 表可留在原处，关开关无需恢复旧数据库。先确认旧网页配对、现有原生客户端、角色和私人空间都仍可使用。线上 LAB 若含未入库的 R4、小游戏、FX 等，必须按当前运行基线移植，不能用仓库旧包覆盖。

试点先只启用直接登录且保留现有 Hall 授权。验证既有 Hall 登录用户、不具资格和明确撤销的账户，以及用已登录的旧专属玩家会话恢复既有 OC 和私人空间。恢复意图必须在会馆明确确认；重复账户或无法证明归属的存档不自动合并。确认试点后，方可考虑开放合格会馆账号，以及启用排队和旧玩家桥接。启用队列前，先测定服务器容量，确认工作人员普通排队且无优先权、有效旧码优先且不能双花、未入场连接不会进入多人世界。切换旧玩家测试码入口前，完成遗留存档核对和原生客户端迁移；不清理真实旧码和身份关系。

出现问题先关闭 LAB 免码入口和排队、关闭 Hall 直接登录和默认普及，保持旧账户桥接、旧测试码及当前数据库。不要用旧备份覆盖新的玩家数据。固定回调来自站点登记表，不从客户端请求、任意转发头或默认站域动态生成。

## 隔离回归
在仓库根目录执行（只用临时数据库和回环测试服务；有系统代理时对回环使用独立测试环境）：

    python -m unittest discover -s apps/huiguan/tests -p test_creator_directory.py
    cd apps/huiguan-lab/server
    python -m pip install -r requirements.txt
    python -m pytest tests/test_account_direct_hall_e2e.py tests/test_account_direct_web.py tests/test_legacy_claim.py tests/test_player_code_closure.py

浏览器与原生客户端另做实测，不以 ASGI 测试代替。
