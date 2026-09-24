# Web Radar 独立服务器副本运维

部署日期：2026-09-24。服务器：47.236.26.22，Ubuntu 24.04 + 宝塔 Nginx。

## 入口与数据边界

- 管理后台：https://web.vnvnv.com ，继续使用原有 Product Radar 账户登录。
- Cloudflare 原站 https://web-radar.net 保留运行；两套数据库和上传素材独立，后续修改不自动同步。
- 服务器上的已发布网站使用 `https://项目ID.sites-server.web-radar.net`，与管理后台不同源。
- 原有 Cloudflare 自定义域名继续指向原站。服务器副本归档这些绑定，禁止调用原 Cloudflare 账户进行写操作；服务器自定义域名绑定界面暂不可用。
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
6. 已发布服务器站点包含后台素材地址。保留旧后台域名重定向，或在副本重新发布这些站点以更新地址。
7. 独立网站通配符域名可继续保留；如也更换，应另行迁移站点 URL、证书和历史链接。

## 已验收范围

快照：21 个项目、807 条素材记录、2014 个对象、17656 个联系人；8 个已发布网站。复制时邮件活动、站内信任务及发送队列均为空，29 个网站任务已完成。

通过原账户身份服务验证、页面读取、SQLite 完整性、浏览器公开导航及元数据拦截、生成服务 Chromium 渲染、图片预览 API。没有为验收向真实收件人发信，也没有提交真实站外联系表单；付费模型生成和邮件送达须以之后真实任务结果为准。
