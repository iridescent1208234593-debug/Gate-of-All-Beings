# 生产变更记录 · 2026-10-24 ~ 2026-10-26

> 本文档记录本轮在生产环境（香港 `154.222.26.70`）完成并验证的全部改动。
> 所有改动均已在线上验证生效，对应分支已推送到 GitHub，**未改动主项目线**。

---

## 一、发布版本时间线

| 版本 | 主要内容 | 自检 |
|---|---|---|
| `20261024T132911Z` | 主域跳转、画廊搬迁、导航顺序、众生之门预加载、手机端修复 | 69/69 |
| `20261025T022201Z` | 更新投票全站计数、zszm-data、画师截图 | 69/69 |
| `20261025T024113Z` | **头像显示修复** + 上传压缩 | 69/69 |
| `20261025T073751Z` | 深浅色主题系统（cookie 跨子站） | 69/69 |
| `20261025T075604Z` | **灵境会馆 API 501 修复** | 69/69 |
| `20261025T080918Z` | 林间门庭接入（后改为「装修中」） | 70/70 |
| `20261025T083534Z` | WAL 修复、任务链、表单主题、移动端 | 70/70 |
| `20261025T092226Z` | 世界地图模块 | 70/70 |
| `20261025T093147Z` | portal.json 注册 world-map | **71/71** |
| `20261025T104819Z` | PayPal 暂停使用 | 71/71 |
| `20261025T110343Z` | site-nav 版本号 bump | 71/71 |
| `20261025T114245Z` | 上传预览 URL 归一化 | 71/71 |

**当前线上：`20261025T114245Z`，自检 71/71 passed**

---

## 二、故障修复（3 个分支）

### 2.1 `fix/portal-management-501` — commit `d7602c7a`

**文件**：`server/portal_server.py`

**问题**：`POST /app/modules/management/api/action` 一直返回 **501**，灵境会馆里点按钮没反应、数据不同步。修复前每天约 4000+ 次失败。

**根因**：模块 API 代理表缺项：

```python
# 修复前
PROXY_PORTS = {"cards": 5174, "card-balance": 5178, "softie": 4173, "juling": 5177}

# 修复后
PROXY_PORTS = {"cards": 5174, "card-balance": 5178, "softie": 4173, "juling": 5177,
               "management": 5177}
```

**为什么是 5177**：灵境会馆内嵌聚灵页面，其前端用相对路径 `fetch('api/action')`，挂载在 management 路径下会解析成 `/app/modules/management/api/action`；全树搜索确认 `api/action` 只有 juling 实现。

**验证**：`501` → `400`（400 = 已路由到 juling 后端，对无效 action 的正常拒绝）

**遗留**：`slay` / `ecology` / `shell` 三个前缀同样缺失，仍在 501（每天约 1840 次）。**未修复原因**：后端归属未确认，猜错端口会污染存档。

---

### 2.2 `fix/avatar-preview-url` — commit `bbf31f8b`

**文件**：`server/account_profile.py`、`server/app/src/cards/src/game/PlayerProfile.tsx`

**问题**：**所有头像（含历史头像）都不显示**。

**根因**：写入端和读取端路径不一致——

```python
# 上传后返回的路径
store_avatar_image() -> "/assets/uploads/<sha256>.jpg"

# 但静态层明确拒绝该前缀（原图不外链，安全设计）
if normalized.startswith("/assets/uploads/"):
    return os.path.join(STATIC_DIR, "__missing__")   # -> 404

# 而 URL 生成函数恰恰拼的就是这个被拒的路径
def asset_public_url(value):
    return "https://huiguan.iridescently.xyz" + value   # -> 必然 404
```

**修复**：改为走可用的预览路由

```python
def asset_public_url(value):
    if not valid_asset_url(value):
        return ""
    return "https://huiguan.iridescently.xyz/api/uploads/preview?name=" + value.rsplit("/", 1)[-1]
```

前端 `identityAssetUrl()` 同步修改（缺一则 cards 端头像仍坏）。

**验证**：头像 URL 从 `404` 变 `200 image/webp`

---

### 2.3 `fix/upload-preview-normalize` — commit `731cda45`

**文件**：`portal/huiguan/image-upload.js`

**问题**：保存图片/头像时报「图片保存地址无效」，因为服务端返回的是预览 URL，前端却按 `/assets/uploads/` 校验。

**修复**：收敛正则常量 + 保存前先 `durable()` 归一化

```js
const ASSET_URL       = /^\/assets\/uploads\/[a-f0-9]{32,64}\.(png|jpg|webp|gif)$/;
const FRESH_AVATAR_URL= /^\/assets\/uploads\/[a-f0-9]{64}\.(png|jpg)$/;
const PREVIEW_URL     = /^\/api\/uploads\/preview\?name=([a-f0-9]{32,64}\.(?:png|jpg|webp|gif))$/;

const savedUrl = durable(result.url);
if (!ASSET_URL.test(savedUrl || '')) throw new Error('图片保存地址无效');
```

**附带**：新增契约测试 `portal/huiguan/tests/image-upload-contract.cjs`

---

## 三、新增功能（2 个分支）

### 3.1 `feat/avatar-compression` — commit `e1d5f3c5`

**文件**：`portal/huiguan/avatar-cropper.js`

**功能**：头像裁切后按原图体积的 **30%** 压缩，画质优先。

```js
const target = sourceBytes ? Math.max(16*1024, Math.round(sourceBytes*0.3)) : 0;
const qualities = [0.92, 0.88, 0.84, 0.80, 0.76, 0.74];
// 从高到低试，取体积达标且画质最高的一档；最低只到 0.74
```

**实测**：2400×2400 大图 **310 KB → 25 KB（7.9%）**，且用的是最高档 0.92（无画质损失）。

---

### 3.2 `feat/member-pagination` — commit `ef85da7d`

**文件**：`portal/huiguan/member.html`

**功能**：成员列表分批渲染，**仅手动下滑才加载**。

```
首屏 40 行 → 底部「向下滑动加载更多…」→ 滚动到距底部 160px 追加 40 行
全部加载完 → 提示行自动移除
统计数字（共 N 位用户）仍为全量，不受分批影响
```

**关键实现**：新行必须插到提示行**之前**（`beforebegin`），否则提示会卡在列表中间。

---

## 四、已回推（新增 2 项）

### 4.0.a `infra/site-notice` — commit `b9c0b14e`

**文件**：`infra/site-notice/notice.js`、`infra/site-notice/README.md`

站点公告弹窗此前**完全不在仓库里**（只存在于服务器 `/srv/iridescently/control/public/notice.js` 与 nginx 注入），服务器重装即丢失。现已纳入版本管理。

- 插画背景（美术组 · 海苔 老师作画）+ 水印
- 设计系统配色（`--qc-panel` / `--qc-text` / `--qc-accent`）
- 同一版本只弹一次（cookie `lxh_notice_<version>`，域 `.iridescently.xyz` 跨子站）
- iframe 内不显示；改文案只需改 `CONFIG`

### 4.0.b `perf/image-lazy-loading` — commit `4d264f8f`

**文件**：7 个会馆页面

给所有 `<img>` 加 `loading="lazy" decoding="async"`，视口外图片浏览器不再请求。

| 文件 | 新增 lazy 图片 |
|---|---|
| `index.html` | 8 |
| `char.html` | 3 |
| `account/fan/member/stickers/works` | 各 1 |
| 合计 | **16** |

对 50 Mbps 带宽 / 30 GB 磁盘的生产环境收益明显：画廊 384 张图，首屏只拉可视区十几张。

---

## 四点五、尚未回推的 2 项（需等布局迁移）

### 4.5.1 深浅色主题接线

**位置**：13 个 `portal/**/*.html` 的导航脚本标签 + `server/app/src/cards/src/gate/GameShell.tsx`

```
每页：<script src=".../site-nav.js?v=20261025b" data-theme-enabled>
GameShell：siteNav()?.mount({ theme: true })
```

**为什么没推**：依赖 master 的主题提交（`f03d6c1`），与现有线纠缠，需基于该提交单独开分支。

### 4.5.2 导航高亮修复（`moreActive`）

**位置**：`shared/shared-ui/site-nav.js`

**问题**：原来只按 host 匹配，任何 `iridescently.xyz` 页面都会点亮「节气画廊」。

**修复**：新增页面级匹配，命中「更多」里的条目时把下划线交给「更多」

```js
var moreActive = MORE.some(pageMatches);
if (site.host === host && !moreActive) link.classList.add('is-site');
if (moreActive) menu.querySelector('summary').classList.add('is-site');
```



---

## 五、附带完成的基础设施项

| 项 | 位置 | 说明 |
|---|---|---|
| 每日数据库快照 | `/usr/local/sbin/iridescently-db-snapshot.sh` + cron 04:15 | `sqlite3 .backup` 只读快照，4 个库，保留 14 天 |
| 全量资产备份 | `/root/dsh-backups/` | 854 MB 用户资产，SHA256 双端一致 |
| 缓存策略 | nginx `map $uri $zszm_cache_ctl` | 源站已返回 `no-cache`，但被 Cloudflare 的 Browser Cache TTL(4h) 覆盖 |
| 头像上传压缩 | 见 3.1 | — |

---

## 六、已知问题与风险

| 问题 | 影响 | 状态 |
|---|---|---|
| `slay` / `ecology` / `shell` API 仍 501 | 这三个模块操作无效，约 1840 次/天 | 待确认后端归属 |
| Cloudflare Browser Cache TTL = 4h | 源站 `no-cache` 被覆盖，用户最多 4 小时才看到更新 | 需在 Cloudflare 面板改为「尊重现有标头」 |
| 仓库已迁移到 `apps/services/packages` | 本记录的补丁是旧布局路径 | 生产仍跑旧布局，切换前需映射 |
| `site-nav.js` 4 小时缓存 | 改动后老访客延迟生效 | 已用版本号 bump 缓解 |

---

## 七、验证方式（每项可复现）

```bash
# 2.1 management 501
curl -X POST -H 'Content-Type: application/json' -d '{}' \
  https://zszm.iridescently.xyz/app/modules/management/api/action
# 期望：400（不是 501）

# 2.2 头像
curl -I 'https://huiguan.iridescently.xyz/api/uploads/preview?name=<sha256>.png'
# 期望：200 image/webp

# 2.3 上传预览
# 在会馆页上传图片并保存，不应报「地址无效」

# 3.1 压缩
# 上传 2400x2400 图片，输出应约为原图 8%

# 3.2 分页
# 打开 member.html：首屏 40 行，不滚动不增行，滚到底追加 40 行
```

---

## 八、回滚

```bash
# 发布级回滚（切回上一版本）
SSH_ORIGINAL_COMMAND=rollback /usr/local/sbin/iridescently-control

# 单文件回滚（member.html 等直接改线上的）
cp /tmp/member.html.bak /srv/iridescently/current/portal/huiguan/member.html
```


---

## 九、已推送分支总览

仓库：`git@github.com:iridescent1208234593-debug/Gate-of-All-Beings.git`
基线：`zszm-batch-20261021` = `f31e7d82`

| 分支 | Commit | 类型 | 内容 |
|---|---|---|---|
| `fix/portal-management-501` | `d7602c7a` | 修复 | 灵境会馆 API 501 |
| `fix/avatar-preview-url` | `bbf31f8b` | 修复 | 头像全部不显示（2 文件） |
| `fix/upload-preview-normalize` | `731cda45` | 修复 | 上传预览 URL 归一化 |
| `feat/avatar-compression` | `e1d5f3c5` | 新功能 | 头像压缩到原图 30% |
| `feat/member-pagination` | `ef85da7d` | 新功能 | 成员列表分批 + 滚动加载 |
| `infra/site-notice` | `b9c0b14e` | 基础设施 | 公告弹窗纳入版本管理 |
| `perf/image-lazy-loading` | `4d264f8f` | 性能 | 图片懒加载（16 个 img） |
| `docs/production-changelog-20261026` | 本文档 | 文档 | 本变更记录 |

**未改动任何主项目线**（`master`、`zszm-batch-20261021`、`batch/7-canonical-structure` 均保持原样）。

### 合并优先级

```
1. fix/portal-management-501      用户「点了没反应」的根因
2. fix/avatar-preview-url         头像全部不显示，影响面最大
3. fix/upload-preview-normalize   与 2 同源，一起验证
4. perf/image-lazy-loading        带宽优化，低风险
5. infra/site-notice              独立文件，低风险
6. feat/avatar-compression        纯增强
7. feat/member-pagination         纯增强
```

