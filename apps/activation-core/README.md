# activation-core

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![许可证](https://img.shields.io/badge/许可证-MIT-green)](LICENSE)
[![状态](https://img.shields.io/badge/状态-重构中-orange)](#项目状态)

`activation-core` 是一个面向单管理员场景的激活码管理系统，提供激活码生成、设备绑定、状态验证和基础后台管理能力。

> [!IMPORTANT]
> 项目正在从手写 SQL 迁移到 Drizzle ORM 新架构。
> 新部署请直接使用 Drizzle migration 初始化数据库。
> 已部署系统升级前，请先备份数据库、导出关键表数据，再在新数据库中执行 baseline migration 后导入数据。

当前关键迁移表：

- `admin_users`
- `activation_codes`

当前已提供基础导出/导入脚本：

```bash
pnpm run db:export -- exports/activation-core-export.json
pnpm run db:import -- exports/activation-core-export.json
```

迁移到新架构时，推荐顺序：

1. 备份旧数据库
2. 导出关键表数据
3. 在新数据库中执行 Drizzle migration
4. 再执行数据导入

## 功能特性

- 首次初始化创建唯一管理员账号
- 管理后台登录与基础统计
- 激活码生成、筛选、分页、重置
- 设备激活状态查询与管理
- 客户端激活与验证接口

## 客户端接口与防重放

`/api/client/verify` 与 `/api/client/activate` 每次调用前都要先取一次性 challenge：

1. `POST /api/client/challenge`，请求体 `{ "device_id": "...", "route": "/api/client/verify" }`（或 `/api/client/activate`），返回 `challenge`，60 秒内有效。
2. 把 `challenge` 放进 verify / activate 的请求体。服务端原子消费：已用（`CHALLENGE_USED`）、过期（`CHALLENGE_EXPIRED`）、设备或接口不符（`CHALLENGE_INVALID`）、缺失（`CHALLENGE_REQUIRED`）一律拒绝。
3. 响应里的 `license_token`（ES256）把这个 challenge 写进 `nonce`。客户端必须先验签，再确认 `nonce`、`device_id`、`route` 与本次请求一致，才能信任“已激活”。

客户端必须内置服务端公钥，缺少时不得跳过验签；参考实现见 `example/activation-client.js`。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Tailwind CSS

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，并至少配置（下面是格式示例，**不是可用的值**）：

```bash
DATABASE_URL=postgresql://username:password@hostname:port/database_name?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
CLIENT_API_KEY=your-client-api-key-at-least-32-characters-long
RESPONSE_SIGN_PRIVATE_KEY_PEM=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
RESPONSE_SIGN_KEY_ID=key-v1
RESPONSE_SIGN_TOKEN_TTL_SEC=120
NODE_ENV=development
```

生产部署还需设置 `IRIDESCENTLY_CLIENT_IP_HEADER`，声明入口代理覆盖的客户端 IP 头（见 `.env.example`）。未设置时服务不信任任何转发头，所有客户端共用一个 IP 限额。

频率限制计数存于数据库表 `rate_limit_buckets`，多实例共享；升级后需执行 `pnpm run db:migrate`。

> [!WARNING]
> 部署时必须重新生成随机凭据：运行 `pnpm run generate-keys`，把输出的 `JWT_SECRET`、
> `CLIENT_API_KEY`（以及启用时的 `ADMIN_SECRET`）填入部署环境。不要使用 `.env.example`
> 或本 README 中的示例值。
>
> `NODE_ENV=production` 时服务启动会统一校验凭据（规则在 `src/lib/server-credentials.ts`），
> 不合格则打印原因并退出：
>
> | 变量 | production 要求 |
> | --- | --- |
> | `JWT_SECRET` | 必填；至少 32 个字符、不少于 8 种不同字符；不能是示例/占位值 |
> | `CLIENT_API_KEY` | 必填；规则同上 |
> | `DATABASE_URL` | 必填；连接串中的密码不能是示例/占位值 |
> | `ADMIN_SECRET` | 可选（不配置则管理密钥通道关闭）；配置时规则同 `JWT_SECRET` |
> | `EVENT_ACCESS_CODE` | 可选（不配置则事件码通道关闭）；配置时至少 12 个字符、不少于 6 种不同字符 |
>
> 非 production 环境只强制 `JWT_SECRET` 已配置且不是示例值，其余问题仅打印告警。

### 3. 初始化数据库

执行 Drizzle migration：

```bash
pnpm run db:migrate
```

如需查看当前 baseline SQL，可参考 `scripts/init-db.sql`，但新部署不再推荐手动执行旧式初始化脚本。

### 4. 启动项目

```bash
pnpm run dev
```

默认入口：

- 首页：`http://localhost:3000`
- 后台：`http://localhost:3000/admin`

## 首次初始化

系统不再提供默认管理员账号。

新部署系统首次访问 `/admin` 或 `/admin/login` 时，会自动跳转到 `/admin/setup`，用于创建唯一管理员账号。系统完成初始化后，该入口会自动关闭。

## 常用脚本

```bash
pnpm run dev
pnpm run build
pnpm run start
pnpm run test
pnpm run generate-keys
pnpm run hash-password -- <password>
ACTIVATION_CORE_TEST_DATABASE_URL=postgresql://.../activation_core_test pnpm test
```

`pnpm test` 只连接 `ACTIVATION_CORE_TEST_DATABASE_URL` 指向的一次性库（库名须含 `test`，测试会清空限流表）；未设置时数据库相关测试显式跳过。

## 项目结构

```text
src/
  db/           Drizzle 客户端、Schema 与 Repository
  server/       服务端业务入口与领域服务
  app/          路由与页面
  components/   界面与后台组件
  contexts/     前端状态管理
  lib/          鉴权、签名与通用工具函数
scripts/        数据库与辅助脚本
example/        客户端示例
```

## 项目状态

当前仓库正在进行认证、安全和文档结构重构。

- README 是当前唯一优先维护的公开入口文档
- 数据库层正在迁移到 Drizzle ORM 新架构
- 详细产品文档后续迁移到专门的文档系统
- 涉及初始化、认证和接口安全的行为，以当前代码实现为准

## 许可证

MIT
