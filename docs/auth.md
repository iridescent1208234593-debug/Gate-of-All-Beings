# 用户系统与鉴权

## 1. 跨站 SSO（hx_sso）

- 实现：`services/platform/hx_sso.py`（跨站共用）。
- Cookie：`hx_sso`，域 `.iridescently.xyz`，`HttpOnly; SameSite=Lax`；token 由 `make_token(uid,kind,name,color)` 签发、`verify_token` 校验、`read_cookie(headers)` 读取。
- 会馆是签发方（登录后写 cookie）；主站 / 人设站 / 各游戏读 cookie 获取登录态。
- 读取端点：各站 `/api/sso-user` 返回 `{logged_in,name,uid,kind,admin}`。
- 管理白名单：`apps/www/server.py` 的 `ADMIN_USSO_IDS`（与会馆 `ADMIN_USSO_IDS` 一致）。

## 2. 会馆账号（站内）

`apps/huiguan/server_huiguan.py`：

| 端点 | 作用 |
| --- | --- |
| `POST /api/register` | 站内注册（写入 `local_users`，密码哈希）；必须带当前 `legal_version`，同意记录写入 `legal_consents` |
| `GET /api/legal` · `POST /api/legal/accept` | 《用户须知》《隐私政策》当前版本与本账号的同意记录（`services/platform/legal_consent.py`） |
| `POST /api/login` | 站内登录 / 或跳转 USSO |
| `GET /api/user` | 当前登录用户（USSO 或站内） |
| `GET /api/sso-user` | 跨站 SSO 登录态 |
| `GET /api/logout` | 退出并清 cookie |
| `POST /api/auth` | 供 management 的注册/登录复用 |
| `POST /api/game/save` · `GET /api/game/load` | 账号云存档 |

灵体使用 `scope=softie` 将参数保存在账号记录的独立命名空间中，不会覆盖灵境会馆的默认存档。主站游戏壳允许对会馆 API 携带账号 Cookie。
| `GET/POST /api/security/<action>` | 账号找回（见下） |

- 账号来源两种：**USSO**（外部 OAuth 2.1/OIDC，`sso.umrc.cn`）与**站内**账号；`users` 存 USSO，`local_users` 存站内。
- 角色：`user` / `executor`（执行者）/ `elder`（长老）/ `admin`；`user_flags` 存封禁与管理标记。
- 会话持久化：`sessions_db(sid,kind,uid,created_at,expires_at)`，重启不掉登录态。

### 会馆 USSO UID 与首次开户

- `USSO_LOGIN_ENABLED` 沿用默认关闭。启用时，会馆还需要非敏感环境变量 `IRIDESCENTLY_USSO_UID_CONTRACT`，缺失或格式无效时 OAuth 入口返回 503。站内注册和账号密码登录使用自己的入口。
- 该变量是 JSON 对象。`field` 从 `id`、`sub`、`social_uid` 中指定一个已核实的权威字段。`value_type` 取 `string`、`integer` 或 `string_or_integer`。`pattern` 是对完整字符串应用的白名单正则，配置应使用与提供方契约一致的明确字符范围。仅当提供方确认两种类型的值可按原样转换为同一个账户键时使用 `string_or_integer`。服务额外限制 UID 为 1–255 个可打印字符，首尾不能有空白。
- 回调只取指定字段，缺失、类型或格式无效时返回 502。合格的字符串保持原值，整数在契约接受时转成十进制文本。有效 UID 精确查找会馆现有 `(usso, uid)`。账户资料和会话在同一事务写入，成功提交后签发 Cookie。
- `allow_new_accounts` 是可选布尔值，默认 `false`。未命中现有账户时返回 403。仅在提供方确认该标识稳定、不会重新分配，且已核对历史 USSO 账户、权限及归属都能用该标识精确识别之后，才在经负责人批准的环境设为 `true`。开启后，稳定标识查无账户时可首次开户，重复或并发回调复用同一个主键。同一个权威字段内的有效值若被提供方意外改掉，应用无法仅凭陌生 UID 将它和真正新用户区分。
- 同一字段名在不同提供方或 OAuth 应用下可能代表不同标识体系。更改提供方、应用或选用字段前，用经授权的脱敏副本只读核对旧键。报告格式异常、无映射、重复映射及受影响的权限、会话、OC 和存档数量。字段值无法精确对齐时，先评审可信映射与回滚方案，再切换。这个实现沿用现有账户键和数据库表。

本机例子见 [OAuth 回归夹具](../apps/huiguan/tests/oauth-mock-server.py)，它使用临时 `test` 存储和模拟 UID 契约。提供方真实契约与生产历史归属需要单独核实。

### 会馆登录与动态事件验收（#139）

本节记录 Issue 的实施步骤和可重复的测试。运行测试只使用临时 `test` 存储和模拟登录服务。

| Issue 待办 | 实施方式与验收证据 |
| --- | --- |
| 1. 盘点动态事件 | 清点成员、管理员、角色和作品页的事件模板，检查生成代码与运行时 DOM。 |
| 2. 追踪数据来源 | 对照账户、角色、作品、评论及审核 API，分别标记来自用户、外部登录服务、数据库整数键、固定选项或本地索引的值。 |
| 3. 验证脚本不执行、功能正常 | 用特殊字符文本验证原值保留。另用无害的可执行源码做浏览器阳性对照，确认探针有效后，把同一源码作为业务数据送入五个页面路径，断言执行次数为 0、未进入脚本节点或事件属性，并核对真实控件操作。 |
| 4. 把数据移出事件代码 | 保留 #178 的成员标识、角色名和重试修复。检查剩余动态事件，用已转义的数据属性与固定监听器传参，动作继续走原 API。 |
| 5. 回调校验标识 | 只接受经核实的单一字段、类型及格式，无效或缺失时拒绝。开发测试提供合成契约，真实提供方契约需要单独核实。 |
| 6. 回调拒绝零写入 | 用临时数据库，对比账户和会话表及登录 Cookie。覆盖无效标识、缺失字段、未核验的旧账号变动、重复开户和事务失败。 |
| 7. 前端回归 | 用真实浏览器点击四页的关键控件，核对处理函数收到正确的参数。调用全部拦截或走临时服务。 |
| 8. 历史数据盘点 | 用授权的离线副本做只读格式统计，输出分类与数量。先用合成快照验证工具，不在此任务执行清理或迁移。 |
| 9. 证据和缺口 | 记录基线及修复后的实际命令、结果和未覆盖条件。测试证据只使用合成账号或汇总数据。 |
| 10. 扩展审计 | 扫描会馆其余模板，追踪命中项的数据来源。修复与本 Issue 同类的数据进入脚本的问题，并在回归中锁定这条边界。 |

#### 动态值来源与处理结论

| 页面 | 来源 | 审计及验证结果 |
| --- | --- | --- |
| 成员管理 | `/api/member/users` 的账户类型、原账户键、昵称和设表。海报、设表名称和编号由业务数据返回。 | 用户文字按 HTML 上下文转义，操作由委托从数据属性读回。用浏览器验证角色、重置密码、展开、删除设表和删除海报的参数。 |
| 管理员 | 审核列表使用数据库申请记录整数键，审批动作及编辑/审核员类型来自固定选项。姓名和备注等来自申请人。 | 申请键经数据属性传递并做整数验证，姓名和备注保留文本显示。验证五类审批队列、驳回及无效申请键。 |
| 角色 | 角色页查询参数、官方角色与图片整数键、图库整数键、合并列表名称和评论文字。图片顺序为浏览器索引。 | 查询参数及图片键规范为安全正整数，图片和主册同人操作用事件监听，名称和评论按原值显示。验证合并选择、删图、置顶、顺序调整、分类、拖放及主册评论操作。 |
| 作品 | 副册图片和评论记录键来自数据库，标题、评论由用户提供，重试动作由客户端固定。 | 作品与评论动作使用事件委托，重试直接绑定函数。验证评论展开、提交、删除和作品删除会调用正确的动作。 |
| 登记页 | 系别选项来自固定表单选项，自设分支和合璧名称来自表单输入或已保存的设表。 | 修复自定义技能名称进入 HTML 模板的问题。标签使用文本节点并绑定移除事件，合璧占位复选框的属性值单独转义。验证含特殊字符名称的显示、取值和删除。 |
| 其他命中 | 账户页是固定豁免类型或数组索引。登记页其余命中是固定系别、数组索引及转为数字的配色键。设计系统资产页使用官方角色整数键、固定头像列表和预设色表。 | 记录来源，当前 Issue 的改动覆盖发现的用户数据进入动态事件或 HTML 的路径。本盘点限会馆页面及关联模板。 |

#### 历史账号只读盘点

取得授权后，将 SQLite 在线备份接口导出的完整单文件副本和已确认的登录契约放到隔离目录。使用：

```powershell
python -B -X utf8 tools/checks/audit-usso-uids.py <离线备份路径> <规则文件路径>
```

命令以 SQLite 不可变、只读模式打开显式指定的副本，拒绝存在日志旁文件的输入。报告只包含账户总数、格式异常数，以及权限、会话、云存档和 SQL 设表 owner 的可用引用统计。`null` 表示副本没有该表，不能推断没有关联。退出码 0 表示审计成功，是否有异常以统计字段为准。

如果发现异常格式或孤立引用，先用提供方证据核对归属，再提出继续保留、经核验后绑定回旧账户或单独迁移的方案。符合格式也不能证明身份来源正确。历史 JSON 设表及已绑定的账户仍需独立核对，格式审计不会自动开启首次开户或改写数据。

#### 本地回归证据

基线为 `d63294b`。按模板中双引号事件属性的插值计数，成员、管理员、角色、作品四页分别是 **0、10、11、4**，修复后为 **0、0、0、0**。新增的真实成员管理测试第一次运行时，统一账号角色或编辑权限更新因后端 SQL 列和值数量不符失败。修复后，两项更新都成功，读取时同时保留前一次设置。

以下命令在 Windows 本地运行，使用本机 Chromium、Node 24.14.0、Python 3.14.3。浏览器可通过既有的 `CHROMIUM_EXECUTABLE` 指定本机可执行文件。

```powershell
node apps/huiguan/tests/safe-event-data.cjs
node apps/huiguan/tests/safe-event-data.cjs --script-source
npm run test:oauth-mock
node apps/huiguan/tests/oauth-e2e.cjs --existing-only
node apps/huiguan/tests/register-flow.cjs
python -B -X utf8 services/platform/tests/test_huiguan_oauth_session.py
python -B -X utf8 services/platform/tests/test_usso_uid_audit.py
python -B -X utf8 apps/huiguan/tests/test_register_rate_limit.py
python -B -X utf8 apps/huiguan/tests/test_member_ban_permission.py
python -B -X utf8 apps/huiguan/tests/test_fanart_comment_threads_http.py
python -B -X utf8 apps/huiguan/tests/test_fanart_volumes.py
python -B -X utf8 services/platform/tests/test_account_profile_scope.py
python -B -X utf8 tools/checks/test_regression.py
git diff --check
```

前端五组事件在特殊字符文本和可执行源码作为数据的两套输入下均通过，两种登录策略的浏览器回归通过，注册界面在 1440 和 390 像素宽度均通过。Python 共 39 个单元用例通过，主副册评论的独立 HTTP 测试通过。只读审计用合成数据库验证了计数、无敏感值输出、未写入快照和异常输入拒绝。

第 3 项独立运行结果：阳性对照在测试页的脚本上下文中执行 **1 次**。使用同一源码作为数据分别走成员、管理员、角色、作品和登记页的流程，执行次数均为 **0 次**，源码未进入脚本节点或事件属性。各页的关键控件操作同时通过。默认前端回归也运行这组验证。

追加复测覆盖两项真实资料的替代验收：

- 用模拟资料切换权威字段，验证多个字段同时指向不同已有账号时只选配置指定的字段。权威字段缺失或在仅允许已有账户时变成未核验的值，会拒绝登录并保持账户和会话计数。整数契约下，带前导零的旧字符串键不会被合并到数值键。登录与会话测试为 17 项。
- 用 SQLite 备份接口导出合成快照，再从备份核对成员权限、会话、云存档和 SQL 设表归属统计。替换测试契约后，格式判定改变，账号键和备份字节保持原样。审计测试为 5 项，覆盖残留日志文件、无效规则或备份拒绝以及脱敏输出。

#### 待核验事项

- 提供方的[公开配置](https://sso.umrc.cn/.well-known/openid-configuration)声明标准字段 `sub`。会馆旧代码优先读取 `id`，真实应用的字段映射、比较语义、稳定性和适用范围仍需提供方资料验证。切换字段或启用首次开户前，应确认老账号键能够精确匹配。
- 真实历史数据盘点需要获准使用的离线备份。格式检查通过后，仍需核对账号、权限、设表和存档的归属。发现异常时先提交清理方案。
- Windows 全量回归使用 Node 22、Python 3.12 和临时存储，补跑浏览器检查后累计 74/81 项通过。其余 7 项在干净的 `master`（`d63294b`）同样复现，其中 6 项涉及临时文件清理，1 项涉及源码域名扫描。PR #209 首次远端合并检查显示失败，当前记录无可读日志，原因待核实。 [PR #209 首次合并检查](https://github.com/iridescent1208234593-debug/Gate-of-All-Beings/actions/runs/45561014899)

### 账号找回 / 安全（services/platform/account_security.py）

动作（`/api/security/<action>`）：`setup`（设置提示问题）、`question`（取问题）、`change`（改密）、`reset`（凭答案重置）、`settings`。
- 哈希答案 + 按账号与 IP 双维度限流（`security_attempts`），原子更新密码。
- 仅限站内账号；USSO 账号需到 USSO 改密。
- 同源校验：Origin 必须为会馆域或 `localhost:8089`。

## 3. 卡牌 OAuth（USSO 客户端）

`apps/cards/server.py`，端口 `5174`：

- `GET /api/login` → 跳 `https://sso.umrc.cn/authorize.php`（`client_id` + `redirect_uri`）。
- `GET /api/callback` → 换 token、取 userinfo。
- `GET /api/user` / `/api/sso-user` / `/api/logout`。
- 用户落 `apps/cards/users.db` 的 `users`。
- 生产回调固定 `https://zszm.iridescently.xyz/api/callback`。
- 前端 API 走 base 感知：`/app/modules/cards/api/*`，由统一入口代理到 `5174`。

## 4. 各站读取与跨域

| 站 | 读取登录态 |
| --- | --- |
| 主站 `apps/www` | `/api/sso-user`（读 hx_sso） |
| 人设站 `apps/oc` | `/api/sso-user` |
| 经营 `management` | `ACCOUNT_API = https://huiguan.iridescently.xyz`（dev 为 `localhost:8089`） |
| 卡牌 | 自有 OAuth（`5174`） |

> 本地跨子域（8080 ↔ 8089）会被 ORB/CORS 拦，属预期；生产走子域正常。

## 5. 安全要点

- Cookie 仅 `HttpOnly`，前端拿不到 token，只能读 `/api/sso-user`。
- 静态白名单：`base_static.static_allowed` 屏蔽 `.py/.db/.log/.bak` 及点文件；`BaseStaticHandler.list_directory` 返回 404。
- 写接口（www 的 `/api/admin/*`）校验同源 + 管理员。

## 6. 角色与权限规则

身份决定御灵系可选数量与年龄上限，规则同时写在前端表单提示里（`apps/huiguan/index.html` 的基础与身份段），改动时两处要同步。

| 身份 | 御灵系可选 | 年龄上限 | 获得方式 |
| --- | --- | --- | --- |
| 未登录访客 | 1 系 | 450 岁 | — |
| 执行者 | 2 系 | 450 岁 | 注册即默认 |
| 长老 | 2 系 | 1500 岁 | 提交申请并经馆长批准，或管理员在后台直接设置 |
| 荣誉长老 / 妖王 | 2 系 | 1500 岁 | 表单页内直接选择，妖王需写明理由 |
| 管理员 | — | — | `ADMIN_USSO_IDS` 中的 USSO 账号，或 `local_users.role='admin'` |

- 兜底：若全站没有任何管理员，第一个注册者自动成为管理员（`server_huiguan.py` 的注册逻辑）。
- 管理员身份与会话标记分离：`ADMIN_USSO_IDS` 是永久白名单，`user_flags.role` 是站内授予。

## 7. 管理后台

页面 `/admin.html`，仅管理员可见入口；接口集中在 `server_huiguan.py` 的 `/api/admin/*`。

| 分组 | 端点 |
| --- | --- |
| 查看 | `/api/admin/users`、`/characters`、`/elder-requests`、`/honor-requests`、`/supplements`、`/scribe-requests`、`/exempt-requests`、`/posters` |
| 用户 | `/api/admin/user/update`（封禁 / 角色）、`/api/admin/user/delete`、`/api/admin/reset-password` |
| 审核 | `/api/admin/elder/decide`、`/honor/decide`、`/supplement/decide`、`/scribe/decide`、`/exempt/decide` |
| 内容 | `/api/admin/delete-character`、`/api/admin/poster/delete` |

封禁后该用户的既有会话立即失效；删除用户会连同其角色卡一并删除，不可恢复。

- 长老后台（`/member.html`，`/api/member/*`）：可查看执行者/编辑、授予或取消文书等级、把执行者设为 executor；不能管理长老或管理员，不能修改账号的封禁状态（`status` 仅 `scope == "all"` 的管理员可改，后端返回 403，不依赖前端隐藏按钮）。
- 管理员专属：封禁 / 解封、设置 elder / admin 角色、重置站内账号密码、删除用户。

## 8. 限流

| 场景 | 计数键 | 阈值 |
| --- | --- | --- |
| 注册 | `reg:{ip}` | 5 次 / 1 小时 |
| 登录失败 | 用户名 + IP 组合 | 8 次 / 10 分钟 |
| 登录失败 | `login-ip:{ip}` | 30 次 / 10 分钟 |
| 登录失败 | `login-user:{user}` | 20 次 / 1 小时 |

计数键形如 `login:{user}`+`{ip}`，实现为 `rate_blocked(key, max_n, window)`，阈值集中在 `LOGIN_FAILURE_LIMITS`；计数每 5 分钟清理一次过期条目（`_RATE_CLEANUP_INTERVAL`）。触发时返回 429 与中文提示。

## 9. 常见问题

- **登录时打错用户名会怎样？** 统一入口 `/api/auth` 是"用户名存在就登录、不存在就注册"，所以拼错的名字会被当成新账号**自动注册并登录**。识别方法：登录后昵称不对、角色卡为空。表单弹窗已提示"用户名不存在时将自动注册并登录"；误建的空账号可由管理员在后台删除。
- **脚本访问接口返回 403 `error code: 1010`？** 这是 Cloudflare 的浏览器完整性检查拦了非浏览器 UA，换成浏览器 UA 即可；真实用户在浏览器里不受影响。