# 节点簿 · Cloudflare Workers 订阅转换

独立前端 + Worker API + D1 持久存储。打开 `/暗号` 编辑节点；客户端导入 `/暗号/sub`，以后保存节点后直接更新同一个订阅地址。

## 部署

需要 Node.js 22+、npm 和自己的 Cloudflare 账号。

```sh
npm install
npx wrangler login
npx wrangler d1 create subscriptions
```

将返回的 `database_id` 填入 `wrangler.jsonc`，然后执行：

```sh
npm run db:remote
npm run deploy
```

访问 Wrangler 返回的 `https://worker-subscriptions.<你的子域>.workers.dev`。也可以在 Cloudflare Workers 设置中绑定自定义域名。前端资源与后端一起部署，不需要 Pages 或第三方订阅转换服务器。不要将占位 database_id 直接用于生产部署。

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

参考：[Workers 静态资源](https://developers.cloudflare.com/workers/static-assets/)、[Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)。
