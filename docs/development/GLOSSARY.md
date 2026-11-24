# 核心术语表

本文件定义《众生之门》仓库中需要跨开发者、跨 AI 保持一致的核心语义。这里定义“概念是什么”，具体字段名和兼容规则见 `NAMING_AND_CONTRACTS.md`。

## 身份与角色

### Account
登录账户。负责认证、权限、账户昵称与账户级资料。Account 不是游戏角色，也不天然具有种族。

当前账户 owner 的稳定语义为 `(kind, uid)` 组合，而不是裸 `uid`。

### Account Avatar
账户通用头像。属于 Account 资料，与 OC 头像、Gate Identity 头像分离。

### OC
作者登记的原创角色。一个 Account 可以拥有多个 OC。OC 有自己的名称、物种、头像和设定，不等于登录账户，也不会自动成为 Gate Identity。

### Gate Identity
《众生之门》中的玩家形象/身份资料。它可以从 Account 或 OC 显式复制部分信息，但复制后独立保存，不自动双向同步。

### Player
面向玩法或 UI 的“玩家”泛称。不要把 `Player` 当作数据库层的统一 owner 概念。若需要持久化归属，必须落到具体的 Account owner、设备本地 scope 或明确的玩法 owner。

### Actor
世界模拟中的实体实例。Actor 是世界内对象，不等于 Account、OC 或 Gate Identity。

### Controller
控制某个 Actor 的控制主体或控制关系。Controller 与登录账户、身份和 Actor 之间的映射必须显式，不允许把 `controller_id` 当作账户 ID 使用。

## 所有权与范围

### Owner
一份数据真正归属于谁/什么。Account 数据的 owner 目前以 `{kind, user_id}` 或等价 `(kind, uid)` 语义表达。其他玩法可能有设备本地、分支、全服等 owner；必须在对应模块文档中明确。

### Scope
用于隔离同类数据的命名空间或玩法槽位，例如 management / softie。Scope 不是 Account，也不能代替 owner。

### Branch
世界或模拟状态的一条分支。Branch 是世界状态拓扑概念，不是 Git branch。代码和文档中涉及 Git 时必须写清 `Git branch`，涉及模拟世界时写 `world branch` 或具体领域名称，避免歧义。

### Release
封存的不可变构建产物。Release 与源码分支、candidate、runtime storage、production 是不同概念。

### Candidate
待验证、尚未发布的构建候选。Candidate 不是 Production。

### Production
当前对真实用户提供服务的线上运行环境。GitHub 合并或 push 不等于 Production 已更新。

### Runtime Storage
运行期数据根，包括数据库、上传、玩法状态等。Runtime Storage 不属于源码 checkout，代码不得假设源码目录就是数据目录。

## 数据与接口

### Contract
被两个或更多模块、进程、客户端、数据库层或外部调用方依赖的稳定接口，包括：字段名、类型、枚举、API 形状、Schema、Cookie/Host/Origin 约定等。

### Canonical
仓库内被指定为唯一真身的实现或定义。新增能力应优先复用 canonical 实现，不复制平行版本。

### Legal Version / Legal Consent（条款版本 / 同意记录）
《用户须知》（`apps/huiguan/terms.html`）与《隐私政策》（`apps/huiguan/privacy.html`）作为一组发布，共用一个版本号 `legal_version`（日期字符串，如 `2026-11-06`），唯一来源是 `services/platform/legal_consent.py` 的 `CURRENT_VERSION`，两页的 `data-legal-version` 由测试保持一致。Legal Consent 是某个 Account `(kind, uid)` 同意了某个版本的记录，存在 `legal_consents(kind, uid, legal_version, context, accepted_at)`，每个版本一行、首次同意为准，`context` 是 `register` / `oc-submit` / `fan-publish` / `account` / `reconsent` / `other`。注册必须同意当前版本；已登录但未同意当前版本的账号在会馆各页只能同意或退出登录，上传 / 发布类接口（`LEGAL_GATED_POSTS`）返回 403 `legal_consent_required`。文本实质修改时升版本号，所有账号需要重新同意。它不是站点公告（`infra/site-notice`），也不是 Cookie 偏好。

### Compatibility Alias
为兼容旧客户端、旧数据库字段或历史接口而保留的名称。Alias 不代表推荐的新代码命名。

### Migration
从旧契约/旧数据到新契约/新数据的受控转换过程。Migration 必须有兼容策略、验证和可回退/可诊断信息，不能用一次全局重命名代替。

### Trusted Client IP（可信客户端 IP）
限流、Turnstile `remoteip` 与防爬观察使用的请求方身份，唯一来源是 `services/platform/host_policy.py` 的 `trusted_client_ip(handler)`（需要 CF-Ray 与“是否可信”时用 `edge_client_identity`）。只有经过统一入口 `enforce_request` 认定的生产 Tunnel 路径（`IRIDESCENTLY_ENVIRONMENT=production`、回环对端、已登记 Host、访客 HTTPS）且带合法 `CF-Ray` 和唯一可解析的 `CF-Connecting-IP` 时才取该头；其余情况（含独立运行的单站服务）一律用 TCP 对端地址。`X-Real-IP`、`X-Forwarded-For` 等转发头不是客户端身份，新代码不得直接读取。

### Errand（会馆托付）
会馆发布、由一个 Account 接下并到指定会馆完成的一件事，界面上叫“托付”。持久化 owner 是 `(kind, uid)`；记录在 `hall_errand_runs`。它不是每日任务（`account_progress` 的 `task-*` 规则）也不是任务链（`task_chains`），三者不要互相替代。代码见 `services/platform/hall_errands.py`。

### Presence（到场）
玩家此刻是否身在某项托付的地点，界面上叫“到场”。由客户端上报 `{place, is_present}`；只有到场的时间计入托付。它不是登录在线状态。

### Bilibili Toy（B站 Toy 门庭）
B站 Toy 平台上的西木会馆门庭页，源码在 `apps/bilibili-toy`，由 `tools/toy/build-toy-bundle.mjs` 构建成静态包。它是独立分发渠道，不是 Release、不是站点的一部分；它不碰会馆账户，只读取匿名只读接口 `/api/toy/archive`（公开同人前十与官方档案摘要），并链接到 `content.json` 批准的根域页面；发布主体永远是项目方自己的 B站 账号。Toy 平台的 `toyOpenId` 只在当前 Toy 内有效，不能当作 Account、`uid` 或 `user_id`。

### Fan Review（同人审核）
同人画廊（`/fan.html`）的上架审核。记录在 `fan_characters.review_status`：`pending`（待审）/ `approved`（通过）/ `rejected`（退回，理由在 `review_note`）。只有 `is_public=1 AND review_status='approved'` 的记录出现在 `/api/fan/list`、展示页兜底与 `/api/toy/archive`；作者改动已公开设表的内容会回到 `pending`。审核权（`can_review_fan`）= 管理员、长老或 `is_fan_reviewer=1` 的账号（`local_users` / `user_flags` 列），它与官方画廊的编辑（`edit_role='scribe'`）是两个互不包含的职位；两种申请共用 `executor_requests`，用 `requested_role`（`scribe` / `fan_reviewer`）区分。存量迁移（负责人 2026-11-06 决定）：列首次加入时，所有存量记录一律为 `pending`，公开设置与内容不变，由审核员在审核台逐个审核。

审核队列与审核员读取的公开列表提供 `review_version`，它是本次查看的公开内容和审核状态的指纹。`POST /api/fan/review/decide` 必须带回该值，服务端在同一写事务内核对，内容或状态已变化时返回 409，要求重新查看后审核。

### Fan Gallery History（同人设表版本与操作记录）
按画廊卡片 ID 保留最近三份已审核通过且公开的内容稿，以及不随内容淘汰的后台操作记录。历史仅管理员可查。库中既有公开稿可在改动前作为观察稿记录，不推断当时的审核时间或操作者。明确人工通过的新稿会关联实际审核事件，供管理员按留存稿追溯。详见 [同人画廊历史与排序](FAN_GALLERY_HISTORY.md)。

### Fan Moderation Reopen（管理员送回复审）
仅站点管理员可以把仍申请公开的已退回同人设表转回待审；该动作不是通过审核，也不会修改作者的公开设置、换卡或恢复旧稿。正常审核台处理新的待审状态。详见 [同人画廊历史与排序](FAN_GALLERY_HISTORY.md)。

### Fan Owner Revision（作者修改后复审）

同人设表已申请公开后，作者实质修改关联设表的内容或公开分类，当前稿进入待审，普通访客看不到待审稿或旧稿；作者自己的站务审核权限不构成该次复审通过。只适用于仍申请公开的关联设表，不恢复已撤回的卡片，也不改变首次投稿或独立分享规则。操作与接口见 [同人画廊契约](FAN_GALLERY_HISTORY.md)。

### Gallery Publication Clock（画廊公开时间）
设表进入「已通过且公开」状态时记录的时间，用于「最新」排序，不采用普通修改时间。存量卡片分级回退到可用审核时间或创建时间，未必是实际公开时间。

### Art Source（立绘来源）
OC 数据与 `fan_characters` 上的 `art_source`：`''` 未声明、`human` 手绘 / 约稿 / 已授权、`ai` AI 生成或 AI 辅助。同人画廊按它与有无立绘分三个分区（`/api/fan/list?view=`）：`art` 有图且非 AI（默认，Toy 也用这个口径）、`text` 纯文字设（无图）、`ai` AI 立绘（页面默认折叠）。作者声明为 AI 会同步；已标为 AI 的不会因作者改声明自动变回，由审核员更正。

## 已知容易混淆的词

- `uid`：部分认证/SSO 层使用的用户标识字段；不能脱离 `kind` 单独作为跨系统 owner。
- `user_id`：多个当前 API/内部归一层使用的账户标识字段；语义上仍需结合 `kind`。
- `player_id`：部分历史 activation / player session 接口中的字段，不自动等于全仓库 Account ID。
- `character`：可能指 OC、玩法角色或世界 Actor。新代码应优先使用更精确术语，禁止仅用 `character_id` 表达一个未定义的跨系统概念。

若新术语会被多个模块使用，必须先加入本文件再进入公共代码。

## 共创与 LAB 账户准入

### Creator Membership（共创身份）
绑定会馆 Account 的组织关系。驻馆共创者 `resident_creator` 对应编内；客席共创者 `guest_creator` 对应编外；无身份用空值表示。小组和职能是可多选的组织职责，不是站务、游戏权限或物种职业。历史贡献记录及公开授权独立保存。

### Creator Profile（共创档案）
成员明确授权公开的署名、个人简介、组织资料、头像、链接和贡献，作为原《联系与鸣谢》中的版块，不是独立公共路由。公开标识 `profile_slug` 是随机值，与 Account `(kind,uid)` 不同。

### LAB Access（LAB 测试资格）
会馆针对 Account 单独授予的测试准入。不会由注册、共创身份或站务身份隐式产生。会馆只把服务专用稳定 `sub` 与短效授权交给 LAB 后端，LAB 的 `player_id` 和已有角色归属不变。
