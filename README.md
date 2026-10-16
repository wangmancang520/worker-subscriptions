# 节点簿 · Cloudflare Workers 订阅转换

**节点会变，订阅地址不变。**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wangmancang520/worker-subscriptions)

基于 Cloudflare Workers 与 D1 的自托管订阅转换服务。通过网页管理 VLESS / Trojan 节点，使用 ACL4SSR 官方在线模板生成 Mihomo 配置，利用暗号路径保持编辑地址和订阅地址固定。

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Storage D1](https://img.shields.io/badge/Storage-D1-F38020)
![Client Mihomo](https://img.shields.io/badge/Client-Mihomo-306EFF)
![Template ACL4SSR](https://img.shields.io/badge/Template-ACL4SSR-26854A)

[快速部署](#部署) · [使用方法](#使用) · [支持范围](#支持范围) · [常见问题](#常见问题) · [反馈问题](https://github.com/wangmancang520/worker-subscriptions/issues)

## 功能亮点

- **固定订阅地址**：更新节点后，客户端直接更新订阅，无需重新导入链接。
- **个人编辑页面**：通过 `/暗号` 打开之前保存的节点，支持多份独立节点集合。
- **D1 持久化**：数据保存在自己的 Cloudflare 数据库，重新部署 Worker 后仍可使用。
- **Worker 内转换**：不依赖第三方订阅转换站，不向模板服务器发送节点信息。
- **ACL4SSR 分流**：保留官方在线模板的策略组与规则顺序，生成 Mihomo rule-providers。
- **明确校验**：错误行、未知参数和不支持的协议直接报错；版本检查防止多页面互相覆盖。

当前版本已通过本地自动测试、Wrangler 打包检查和本地 D1 迁移验证；云端部署及真实代理连接仍需在自己的环境中验证。本项目用于管理和转换已有节点，不提供代理节点或代理流量转发。

## 工作原理

```mermaid
flowchart LR
  A[浏览器：输入暗号和节点] -->|保存| B[Worker API]
  B --> C[(D1 数据库)]
  D[代理客户端：固定订阅地址] --> E[Worker 配置生成器]
  C --> E
  F[ACL4SSR 官方模板] --> E
  E -->|Mihomo 配置| D
  D -->|更新分流规则| G[ACL4SSR 规则列表]
```

前端位于 `public/`，后端位于 `src/`，通过 HTTP API 通信。两者以一个 Workers 项目同源部署。

| 地址 | 功能 |
| --- | --- |
| `/` | 创建暗号和节点集合 |
| `/:secret` | 读取并编辑指定集合 |
| `/:secret/sub` | 下载该集合的最新 Mihomo 配置 |

## 部署

需要自己的 Cloudflare 账号。本地开发建议使用 Node.js 24 与 npm（本项目测试使用 Node 内置 SQLite）。GitHub 仅托管源码，服务运行于 Cloudflare Workers，不适用于 GitHub Pages。

### 方式一：一键部署（推荐）

点击上方 **Deploy to Cloudflare** 按钮，按向导完成以下操作：

1. 登录 Cloudflare，并授权连接自己的 GitHub 账号。
2. 确认新仓库、Worker 和 D1 数据库的名称。
3. 保留自动识别的部署命令 `npm run deploy`（使用 pnpm 时为 `pnpm run deploy`），然后确认部署。
4. 等待部署完成，打开分配的 `workers.dev` 地址，保存节点并导入订阅。

Cloudflare 会将此模板复制到你的 Git 账号，自动创建 D1 并更新新仓库中的数据库 ID。项目的 `deploy` 脚本先运行数据库迁移，再部署 Worker，因此无需手动建表。构建命令可以留空，本项目没有前端编译步骤。

模板中的全零 `database_id` 只是占位符；一键部署流程负责替换。不要把模板占位值覆盖回已经部署的仓库。后续修改应推送到部署向导创建并连接的仓库；原始模板的更新不会自动同步过去。

按钮及迁移脚本已配置；完整的账号授权、资源创建和首次云端部署仍需要在你的 Cloudflare 账号内验证。参见 [Cloudflare 官方一键部署说明](https://developers.cloudflare.com/workers/platform/deploy-buttons/)。

### 方式二：本地命令行部署

```sh
git clone https://github.com/wangmancang520/worker-subscriptions.git
cd worker-subscriptions
npm install
npx wrangler login
npx wrangler d1 create subscriptions
```

将返回的 `database_id` 填入 `wrangler.jsonc`，然后执行：

```sh
npm run deploy
```

访问 Wrangler 返回的 `https://worker-subscriptions.<你的子域>.workers.dev`。也可以在 Cloudflare Workers 设置中绑定自定义域名。前端资源与后端一起部署，不需要 Pages 或第三方订阅转换服务器。不要将占位 database_id 直接用于生产部署。

### 方式三：已有仓库连接 GitHub 自动部署

1. 将本项目保存到你有管理权限的 GitHub 仓库。
2. 在 Cloudflare 创建名为 `subscriptions` 的 D1 数据库，将它的 ID 填入 `wrangler.jsonc` 并提交到仓库。数据库 ID 是资源标识；不要把 Cloudflare API Token 提交到仓库。
3. 在 Cloudflare Workers & Pages 中创建 Worker，连接 GitHub 仓库，配置如下：

| 设置 | 值 |
| --- | --- |
| Worker 名称 | `worker-subscriptions`，与 `wrangler.jsonc` 的 `name` 一致 |
| 生产分支 | `main` |
| 根目录 | 仓库根目录 |
| 构建命令 | `npm test` |
| 部署命令 | `npm run deploy` |

4. 确认构建环境使用 Node.js 24，部署凭证具有 Worker 部署和对应 D1 数据库编辑权限。
5. 部署成功后访问分配的 `workers.dev` 域名，保存一份节点并在客户端验证订阅。之后推送到 `main` 即可触发后续部署。

数据库迁移会记录已执行的版本，正常重新部署不会清空节点。不要在更新时删除数据库或随意替换绑定。参考 [Workers Builds 官方说明](https://developers.cloudflare.com/workers/ci-cd/builds/)。

## 本地开发与验证

```sh
npm run db:local
npm run dev
npm test
```

测试使用 Node 内置 SQLite 执行实际迁移和查询，覆盖节点转换、官方模板、创建/读取/更新、版本冲突、跨站保存拒绝、请求大小限制以及固定订阅地址更新。测试不访问网络，模板样本保存在 `tests/fixtures`。

## 使用

1. 首页自动生成 192 位随机暗号；也可以输入至少 16 位的自定义暗号，点击「打开」。
2. 每行粘贴一个节点链接，点击「保存并生成订阅」。
3. 将固定订阅地址导入支持 Mihomo 的客户端，例如使用 Mihomo 内核的 Clash 客户端。
4. 收藏个人编辑地址。以后在该页面修改节点、保存，再在客户端更新订阅。

暗号就是读写凭证，没有另外的账号密码。订阅地址包含同一个暗号，持有订阅地址的人也能编辑节点。请使用默认随机暗号，不要公开地址。数据库只存暗号的 SHA-256，节点内容存储在你自己的 D1 中；这不是端到端加密。页面不将节点写入 localStorage，不引入第三方脚本，响应禁止缓存并禁用 Referrer。不要在 Cloudflare 访问日志中公开含暗号的路径。公开部署建议为 `/api/*` 配置 Cloudflare 限流，避免陌生人批量创建数据。

## 支持范围

- VLESS：UUID、TLS、Reality、XTLS Vision，TCP / WS / gRPC。
- Trojan：TLS，TCP / WS / gRPC。
- 支持 SNI、指纹、ALPN、WS Host/path、gRPC serviceName、Reality public-key/short-id。
- 每份最多 200 节点，请求最大 128 KiB。错误行或未知参数直接拒绝，避免悄悄生成错误配置。
- 暂不支持 VMess、Shadowsocks、Hysteria2、远程订阅 URL、XHTTP 和其他客户端格式。不支持旧版 Clash 内核中的 VLESS。
- JSON 形式输出 YAML 1.2 配置（文件名 `.yaml`），由 Mihomo 解析。

## ACL4SSR 模板

使用官方 [ACL4SSR_Online.ini](https://github.com/ACL4SSR/ACL4SSR/blob/master/Clash/config/ACL4SSR_Online.ini)。首次订阅时获取，Worker 实例内缓存 1 小时。转换器解析模板里的 `custom_proxy_group` 和 `ruleset`，保留分组与规则顺序。规则列表转成 Mihomo HTTP rule-providers，由客户端从 ACL4SSR 官方仓库更新。节点链接不会发送给模板服务器。

本实现针对此官方模板，不是完整 subconverter INI 解释器。模板获取失败返回 502；客户端初次下载规则需要访问 GitHub。模板以及规则上游变更可能影响后续配置，追求固定版本时可将 `TEMPLATE_URL` 和规则来源验证逻辑改成经验证的提交地址。

## 文件与接口

| 文件 / 路径 | 用途 |
| --- | --- |
| `public/` | HTML、CSS、浏览器 JS |
| `src/worker.js` | API、持久化、静态页面路由 |
| `src/converter.js` | 节点解析、模板转换 |
| `migrations/` | D1 表结构 |
| `GET /api/profiles/:secret` | 读取节点及版本 |
| `PUT /api/profiles/:secret` | `{nodes, revision}`，创建 revision=0，更新使用读取到的版本 |
| `GET /:secret/sub` | 当前节点的 Mihomo 配置 |

API 不提供公开用户列表。写操作要求同源 Origin，版本不匹配返回 409。前后端在源代码与职责上分离，通过 HTTP API 通信；同源部署便于保护写入接口。

## 常见问题

**更新了节点，为什么客户端仍是旧节点？**

先确认网页显示保存成功，再在客户端主动更新原订阅。仅修改文本框不会写入数据库。订阅响应设置 `no-store`，但客户端的自动更新周期由客户端决定。

**忘记暗号怎么办？**

如果仍保留订阅链接，可以从其中找到暗号路径。没有找回账号或重置暗号功能，请收藏编辑地址；不要把它放进公开书签或 Issue。

**保存时提示版本冲突？**

说明同一个暗号已在其他页面更新。先自行保留尚未保存的修改，重新打开个人页面，合并内容后再保存。

**页面能打开，但无法保存或下载订阅？**

- `503`：检查 `DB` 绑定、数据库 ID，以及是否已执行远程迁移。
- `502`：检查 ACL4SSR 模板访问和上游格式，稍后重试。
- `400`：按页面提示检查节点协议、参数和暗号格式。
- `404`：确认暗号正确且对应节点已保存。

**能把订阅链接分享给别人使用吗？**

当前订阅与编辑共用暗号，分享订阅也会授予编辑能力。当前版本没有独立的只读订阅令牌。

## 反馈与贡献

欢迎通过 [GitHub Issues](https://github.com/wangmancang520/worker-subscriptions/issues) 提交问题或功能建议。请提供复现步骤、客户端及内核版本、错误提示和预期行为。节点示例应替换服务器、UUID、密码和 Reality 公钥；不要附带真实暗号、完整订阅地址或 API Token。

修改转换逻辑后请运行 `npm test`。当前没有为本项目指定开源许可证；公开仓库不代表授予任意再分发或商业使用权限。第三方模板及规则遵循其上游项目的条款。

## 致谢

- [Cloudflare Workers / D1](https://developers.cloudflare.com/workers/)：服务运行与数据存储。
- [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR)：分流模板与规则列表。
- [Mihomo](https://github.com/MetaCubeX/mihomo)：配置消费端内核。

参考：[Workers 静态资源](https://developers.cloudflare.com/workers/static-assets/)、[Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)。
