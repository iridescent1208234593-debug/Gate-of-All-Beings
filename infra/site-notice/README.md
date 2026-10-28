# 站点通知弹窗（Site Notice）

生产环境通过 nginx 注入的公告弹窗。此目录用于**将弹窗纳入版本管理**，避免只存在于服务器磁盘上。

## 文件

| 文件 | 说明 |
|---|---|
| 
otice.js | 弹窗实现（纯 IIFE，无依赖，约 6.7 KB） |
| 
otice-bg.webp | 背景插画（美术组 · 海苔 老师作画），约 140 KB，**需单独放置** |
| 
ginx.conf.snippet | 生产 nginx 注入片段 |

## 部署方式（当前生产做法）

文件放在服务器的 /srv/iridescently/control/public/，由 nginx 提供两个路由并注入所有页面：

``nginx
    }
    location = /__notice.js {
        alias /srv/iridescently/control/public/notice.js;
        default_type application/javascript;
        add_header Cache-Control "no-store" always;
    }
    location = /__notice-bg.webp {
        alias /srv/iridescently/control/public/notice-bg.webp;
        default_type image/webp;
        add_header Cache-Control "public, max-age=86400" always;
    }
``

注入的脚本标签：

`html
<script defer src="/__notice.js?v=20261025j"></script>
`

## 行为约定

- **同一版本只弹一次**：cookie lxh_notice_<version>，域为 .iridescently.xyz，跨子站共享
- **iframe 内不显示**：window.self !== window.top 直接返回
- **改文案**：编辑 
otice.js 顶部的 CONFIG，无需重新发布
- **让所有人再看一次**：修改 CONFIG.version（同时更新 nginx 里的 ?v= 参数）

## 配色

全部取自设计系统色板（design-system/colors.html）：

`
--qc-panel  #fbf8f2   卡片底
--qc-bg     #f5f0e8   条目底
--qc-border #d4cfbe   边框
--qc-text   #3a4a3e   正文
--qc-dim    #7a8a7e   次要文字
--qc-accent #5a9e8f   主按钮
`

## 已知限制

- 背景图 
otice-bg.webp 未纳入本仓库（二进制资产），需从生产服务器 /srv/iridescently/control/public/notice-bg.webp 取回
- 未来若迁移到新布局，建议放在 infra/site-notice/，并在发布器中加入对应的静态路由
