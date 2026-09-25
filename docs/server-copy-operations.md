# Web Radar 独立服务器副本运维

部署日期：2026-09-24。服务器：47.236.26.22，Ubuntu 24.04 + 宝塔 Nginx。

## 入口与数据边界

- 管理后台：https://web.vnvnv.com ，继续使用原有 Product Radar 账户登录。
- Cloudflare 原站 https://web-radar.net 保留运行；两套数据库和上传素材独立，后续修改不自动同步。
- 服务器上的已发布网站使用 `https://项目ID.sites-server.web-radar.net`，与管理后台不同源。
- 原有 Cloudflare 自定义域名继续指向原站。服务器副本归档这些绑定；新增 Cloudflare 发布使用独立 `wrs-` 项目，禁止写入原 `wr-` 项目。
- 新项目默认 Cloudflare，复制的现有项目保持服务器托管。在「预览与发布 → 发布检查 → 网站发布位置」保存选择，再发布。切换已有站点需确认，并先解绑自定义域名；新发布失败时原成功版本仍提供服务。
- 「上线管理 → 自定义域名」按实际发布位置创建 CNAME（Cloudflare）或 A（服务器）。服务器域名使用仅 DNS 模式，后台自动申请 HTTPS；有冲突的解析不会覆盖。
- 公共素材与发布网关使用 `https://public-server.web-radar.net`；该域名仅开放公开站点资源、签名素材与询盘接口，后台登录/API 不可从该域名访问。素材仍存放在本服务器，Cloudflare 网站的素材、询盘与发布状态检查依赖服务器可用性。
- 外部身份服务、模型、Resend 等仍使用原有服务账户及其配额。复制部署不代表这些第三方服务也被迁入服务器。
- 复制的 Resend webhook ID/签名密钥已清除；如需服务器独立接收事件，应在副本中重新连接 webhook，不覆盖 Cloudflare 原回调。

## 架构

宝塔 Nginx 负责 HTTPS；Docker Compose 运行 Node 24 API、Python 建站服务和 Browserless Chromium。未依赖 PHP/MySQL，也未变更原有 MySQL。

D1 调用由本地 SQLite 适配；R2 对象由本地不可变文件和 SQLite 元数据保存；队列使用 SQLite 持久化、延迟调度、租约及重试。该方案适用于当前单机，不支持直接扩为多个 API 副本。此实际方案未安装 Redis。

浏览器和渲染服务的出站规则阻止访问私网、主机其他端口和云元数据地址。内部端口 3000/7002 只绑定回环地址。容器重建后须刷新规则。

## 路径

| 内容 | 路径 |
|---|---|
| 当前程序 | `/opt/web-radar/current` |
| 当前版本 | `/opt/web-radar/releases/20260924-server` |
| 应用数据库 | `/srv/web-radar/data/app.sqlite3` |
| 上传与生成素材 | `/srv/web-radar/data/media` |
| 建站服务数据 | `/srv/web-radar/builder` |
| 服务密钥与环境配置 | `/etc/web-radar`（仅 root 可读） |
| 加密备份 | `/srv/web-radar/backups` |
| 宝塔 Nginx 配置 | `/www/server/panel/vhost/nginx/web-radar-server.conf` |
| 后台证书 | `/etc/letsencrypt/live/web-radar-main` |
| 网站通配符证书 | `/etc/letsencrypt/live/web-radar-server` |

`ASSET_SIGNING_KEY` 同时用于既有服务商凭据加密，不能随意更换，否则已保存凭据无法解密。不要将 `/etc/web-radar` 或数据库提交到 Git。

## 常用操作

```sh
systemctl status web-radar-server.service
cd /opt/web-radar/current
docker compose --env-file /etc/web-radar/compose.env -f deploy/server/compose.yml ps
docker compose --env-file /etc/web-radar/compose.env -f deploy/server/compose.yml logs --tail=100 api
curl https://web.vnvnv.com/api/server/readiness
```

更新环境后：

```sh
cd /opt/web-radar/current
docker compose --env-file /etc/web-radar/compose.env -f deploy/server/compose.yml up -d --no-build
sh deploy/server/network-isolation.sh
```

`SERVER_TASKS_ENABLED` 控制后台队列，`true` 才执行新建任务。切勿在未经审查的生产数据快照上直接启用，以免重复发送历史邮件。

构建源代码：Node 24，先 `npm ci`，再 `npm ci --prefix src/server/dependencies`，运行 `npm run typecheck`、`npm run test:server`、`npm test`、`npm run build:server`。建站镜像由 `deploy/server/Dockerfile.builder` 构建。替换程序时保留 `/srv/web-radar` 与 `/etc/web-radar`，不得重复覆盖初始数据快照。

## 备份、恢复与证书

- 每日 UTC 19:15（北京时间次日 03:15）运行 `/etc/cron.d/web-radar-backup`。
- 自动保留最近约 14 天的日备份，初始复制归档保留。
- 采用 SQLite 在线备份，再保存不可变素材和配置，使用 AES-256/PBKDF2 加密。
- 解密密钥：`/etc/web-radar/backup.key`。须另存到受控的异地密码库；当前只有服务器本地备份，不具备整机丢失后的异地恢复能力。
- 初始复制归档：`/srv/web-radar/backups/initial-copy.tar.gz`，仅 root 可读。
- 手动备份：`sh /opt/web-radar/current/deploy/server/backup.sh`。
- 恢复时先停止服务，解密到单独目录并执行 SQLite `PRAGMA integrity_check`；确认备份版本后再替换数据库、素材和配置，恢复 UID/GID 1000 的数据目录权限，再启动服务。不要将旧的 WAL/SHM 与恢复的数据库混用。
- Certbot timer 自动续期；deploy hook 检查并重载宝塔 Nginx。

## 后续更换后台域名

1. 新域名 A 记录指向服务器，先用仅 DNS 模式。
2. 为新域名签发证书，更新 Nginx server_name 与证书路径。
3. 更新 `/etc/web-radar/server.env` 的 `APP_ORIGIN` 和 `SITE_BUILDER_URL`（后者以 `/builder` 结尾）。
4. 重建 API 容器并刷新网络隔离规则。
5. 重新连接服务器 Resend webhook 到新地址；保留 Cloudflare 原回调。
6. 保持 `PUBLIC_SITE_ORIGIN=https://public-server.web-radar.net` 不变。新的发布与已更新的服务器缓存使用该独立素材域名；外部旧链接建议保留旧后台域名重定向。
7. 独立网站通配符域名可继续保留；如也更换，应另行迁移站点 URL、证书和历史链接。

## 已验收范围

快照：21 个项目、807 条素材记录、2014 个对象、17656 个联系人；8 个已发布网站。复制时邮件活动、站内信任务及发送队列均为空，29 个网站任务已完成。

通过原账户身份服务验证、页面读取、SQLite 完整性、浏览器公开导航及元数据拦截、生成服务 Chromium 渲染、图片预览 API。没有为验收向真实收件人发信，也没有提交真实站外联系表单；付费模型生成和邮件送达须以之后真实任务结果为准。

## 发布与域名运维

- `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` 为默认发布账号，仅存服务器环境文件；页面返回账号标识，不返回密钥。额外账号可在平台管理或网站上线管理中添加，需要 Pages Edit、Zone Read、DNS Edit 权限。
- `SERVER_INSTANCE_ID` 必须稳定，参与新 Pages 项目命名与 DNS 所有权标记。不要在部署中随意更改。
- `SERVER_PUBLIC_IP` 决定服务器域名的 A 记录，当前为 `47.236.26.22`。
- `web-radar-domains.timer` 每分钟检查待配置的服务器域名；失败域名最多每十分钟尝试一次。检查 `journalctl -u web-radar-domains.service`。
- 自动证书要求域名 DNS 指向本服务器，80/443 可达，CAA 允许 Let's Encrypt。已存在代理记录请先在 DNS 后台改为仅 DNS。
- 网站 vhost 位于宝塔 Nginx 目录 `wr-site-<hash>.conf`；仅清理该命名空间中已解绑的配置，不修改其他宝塔站点。
- 证书生效后可刷新绑定状态；重新发布会将 canonical 与 sitemap 切换到已生效的自定义域名。
- 设置 API：`GET/PUT /api/projects/:id/deployment`，需项目管理权限。PUT 带 `expectedVersion`、`provider`，Cloudflare 还需 `credentialId`、`accountId`，迁移已发布项目需 `confirmMigration: true`。
- 不能在发布进行中更换部署位置或修改绑定；不会自动搬迁现有自定义域名。

## 页面资源与性能

- Nginx 需要 1.25.1 以上版本，并编译 HTTP/2、gzip_static 模块。HTTPS 启用 HTTP/2，支持并发加载项目图片与接口。
- 将 `deploy/server/static-assets.conf`、`static-templates.conf` 连同 `nginx.conf` 部署到 `/opt/web-radar/current/deploy/server`；验证 `nginx -t` 后重载。主控制台的 `/assets/`、主控制台与公开素材域名的 `/templates/` 直接读取 `dist`，不经过 Node。
- `npm run build:server` 为 JS/CSS 等生成 gzip 副本。部署时一并复制 `.gz` 并保留文件时间；Nginx 根据浏览器能力选择压缩文件，原文件仍可使用。更新资源时必须同步对应 gzip 副本，避免旧副本与原文件不一致。
- 带内容哈希的 `/assets/` 缓存一年；公开模板素材缓存一小时并提供 ETag、视频范围请求。部署时保留上一版本的哈希资源，避免已打开页面动态加载旧模块失败。不要覆盖相同哈希名的内容。
- 首页 HTML 保持 `no-store`，及时获取最新入口；私人素材、账户和业务 API 继续走应用鉴权及 `no-store`，不可加入公开静态目录或共享缓存。
- 修改本节的 Nginx 配置无需重启 API 容器，不中断后台任务。回滚时先恢复备份 vhost，验证配置后重载；新静态文件可以保留。

## 账户服务连接

- 服务器针对 `PRODUCT_RADAR_BASE_URL` 的精确来源地址使用独立连接池，最多 4 条连接、空闲复用上限 60 秒；上游可提前关闭连接。TLS 校验保持开启，不固定 Cloudflare IP，也不修改其他服务商的连接池。
- 实时身份查询最多尝试 2 次，每次 15 秒，覆盖响应头与响应正文的读取。网络中断和上游 5xx 可以重试；401、403、429、格式无效和身份不匹配直接返回错误。登录密码请求和业务写入不重放。
- 只合并同一账号、工作区同时进行的身份查询，不缓存已完成的权限结果。账户服务持续不可用时拒绝访问，不使用旧权限放行。
- 网络验收需要分别观察首次连接与复用连接。连接池减少反复建连，不能替代上游服务或跨境网络故障的修复。
