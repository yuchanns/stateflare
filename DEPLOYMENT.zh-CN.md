# Stateflare 部署指南

本指南将帮助您将 Stateflare 部署到 Cloudflare Workers。

## 前置要求

1. Cloudflare 账号（免费版即可）
2. Node.js（v16 或更高版本）和 npm
3. 安装 Git

## 分步部署指南

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 克隆并设置项目

```bash
git clone https://github.com/yuchanns/stateflare.git
cd stateflare
npm install
```

### 3. 登录 Cloudflare

```bash
wrangler login
```

这将打开浏览器窗口进行身份验证。

### 4. 创建 D1 数据库

```bash
wrangler d1 create stateflare-db
```

您将看到类似以下的输出：

```
✅ Successfully created DB 'stateflare-db'!

[[d1_databases]]
binding = "DB"
database_name = "stateflare-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 5. 更新配置

复制上面输出中的 `database_id` 并更新 `wrangler.toml` 文件：

```toml
[[d1_databases]]
binding = "DB"
database_name = "stateflare-db"
database_id = "your-actual-database-id-here"  # 替换成您的实际 database_id
```

### 6. 运行数据库迁移

```bash
wrangler d1 migrations apply stateflare-db
```

这将在您的 D1 数据库中创建必要的表。

### 7. 部署 Worker

```bash
wrangler deploy
```

部署后，您将看到类似以下的输出：

```
✨  Build succeeded!
✨  Successfully published your script to
   https://stateflare.your-subdomain.workers.dev
```

### 8. 测试部署

在浏览器中访问您的 Worker URL：
```
https://stateflare.your-subdomain.workers.dev
```

您应该看到："Stateflare - Visitor Counter Service"

测试跟踪脚本：
```
https://stateflare.your-subdomain.workers.dev/track.js
```

这应该返回 JavaScript 跟踪代码。

## 本地开发

### 启动开发服务器

```bash
npm run dev
```

对于本地开发，您需要使用本地 D1 数据库：

```bash
wrangler d1 migrations apply stateflare-db --local
```

然后运行：
```bash
wrangler dev
```

## 使用方法

部署完成后，在您的网站 HTML 中添加以下代码：

```html
<script defer src="https://你的-worker.workers.dev/track.js"></script>
<label id="uv_label">UV</label> /
<label id="pv_label">PV</label>
```

将 `你的-worker.workers.dev` 替换为您实际的 Worker URL。

## 功能说明

### UV（独立访客）
- 基于访客的 IP 地址和 User-Agent 的 SHA-256 哈希值进行永久去重
- 同一访客无论访问多少次，UV 只计数一次
- 数据永久存储，不会过期

### PV（页面浏览量）
- 每次页面访问都会增加 PV 计数
- 累积站点的总访问次数

### 多站点支持
- 自动根据来源 URL 识别站点
- 每个站点维护独立的 UV/PV 统计
- 例如，如果您的网站部署在 `xxx.github.io/yyy`：
  - 访问 `xxx.github.io/yyy/zzz` 会统计到 `xxx.github.io/yyy`
  - 访问 `xxx.github.io/yyy/aaa` 也会统计到 `xxx.github.io/yyy`
  - 所有子路径都会合并统计到根路径

## API 接口

### GET /track.js
返回跟踪脚本，应嵌入到您的网站中。

### POST /track
内部接口，由跟踪脚本用于记录访问。

### GET /stats?site=<站点来源>
查询特定站点的统计信息。

**示例：**
```bash
curl "https://你的-worker.workers.dev/stats?site=https://example.com/blog"
```

**响应：**
```json
{
  "uv": 123,
  "pv": 456
}
```

## 工作原理

1. 当访客加载您的页面时，`track.js` 脚本被执行
2. 脚本发送带有来源 URL 的跟踪请求
3. Worker 从来源 URL 中提取站点根路径
4. 使用访客的 IP 和 User-Agent 生成访客哈希值
5. Worker 检查这是否是该站点的新独立访客
6. UV（独立访客）仅对新访客递增
7. PV（页面浏览量）每次访问都递增
8. 更新后的统计数据返回并显示在页面上

## 隐私保护

- 访客识别使用 IP + User-Agent 的 SHA-256 哈希
- 不使用 Cookie 或 localStorage
- 不直接存储个人信息
- 仅维护聚合统计信息

## 配置选项

### 自定义 Worker 名称

在 `wrangler.toml` 中更新：

```toml
name = "my-custom-name"
```

### 自定义域名

要使用自定义域名：

1. 将您的域名添加到 Cloudflare
2. 在 Cloudflare 控制台，进入 Workers & Pages
3. 选择您的 Worker
4. 进入设置 > 触发器
5. 添加自定义域名

## 故障排除

### 数据库连接问题

如果遇到数据库连接错误，请检查：
1. wrangler.toml 中的 database_id 是否正确
2. 是否已应用迁移：`wrangler d1 migrations list stateflare-db`
3. 数据库是否存在：`wrangler d1 list`

### CORS 问题

如果浏览器控制台出现 CORS 错误，请检查：
1. Worker 是否已部署且可访问
2. 您的网站是否使用 HTTPS（Cloudflare Workers 需要 HTTPS）

### 限额说明

Cloudflare Workers 免费版包含：
- 每天 100,000 次请求
- 每次请求 10ms CPU 时间
- D1：5GB 存储空间，每天 500 万次读取，10 万次写入

对于大多数中小型网站，免费版已经足够使用。

## 更新部署

更新您的部署：

```bash
git pull
npm install
wrangler deploy
```

## 监控

实时查看日志：

```bash
wrangler tail
```

查看数据库内容：

```bash
wrangler d1 execute stateflare-db --command "SELECT * FROM site_stats"
```

## 成本估算

Cloudflare Workers 免费版：
- 每天 100,000 次请求
- 每次请求 10ms CPU 时间
- D1：5GB 存储空间，每天 500 万次读取，10 万次写入

对于大多数个人或中小型网站来说，免费版完全够用。如果您的网站流量较大，可以考虑升级到付费版。
