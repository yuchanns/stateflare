# Stateflare

A lightweight visitor counter that runs on your own Cloudflare Workers with D1 database storage.

一个基于 Cloudflare Workers 和 D1 数据库的轻量级访客统计工具。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yuchanns/stateflare)

[English](#english) | [中文](#中文)

---

## English

### Features

- **UV (Unique Visitors)**: Tracks unique visitors based on IP + User-Agent hash (permanent deduplication)
- **PV (Page Views)**: Counts total page views (increments on each visit)
- **Multi-site Support**: Each site origin maintains its own separate UV/PV counters
- **Privacy-Focused**: Uses hashed visitor identification, no cookies or localStorage
- **Scalable**: Powered by Cloudflare Workers and D1 database
- **Easy Integration**: Just add a single script tag to your website

### Quick Start

#### 1. Prerequisites

- A Cloudflare account
- Node.js and pnpm installed
- Wrangler CLI installed: `pnpm install -g wrangler`

#### 2. Setup

```bash
# Clone the repository
git clone https://github.com/yuchanns/stateflare.git
cd stateflare

# Install dependencies
pnpm install

# Login to Cloudflare
wrangler login

# Create a D1 database
wrangler d1 create stateflare-db

# Update wrangler.toml with your database_id from the output above
# Replace the database_id in wrangler.toml with the actual ID

# Run migrations
wrangler d1 migrations apply stateflare-db

# Deploy to Cloudflare Workers
wrangler deploy
```

#### 3. Usage

Add the following code to your website:

```html
<script defer src="https://your-worker.workers.dev/track.js"></script>
<label id="uv_label">UV</label> /
<label id="pv_label">PV</label>
```

Replace `your-worker.workers.dev` with your actual Cloudflare Worker URL.

### API Endpoints

#### GET /track.js
Returns the tracking script that should be embedded in your website.

#### POST /track
Internal endpoint used by the tracking script to record visits.

#### GET /stats?site=<site_origin>
Query statistics for a specific site origin.

**Note**: The `site` parameter should match the extracted site origin (origin + first path segment). For example, if your site is at `example.com/blog`, use `https://example.com/blog`.

**Example:**
```bash
curl "https://your-worker.workers.dev/stats?site=https://example.com/blog"
```

**Response:**
```json
{
  "uv": 123,
  "pv": 456
}
```

### How It Works

1. When a visitor loads your page, the `track.js` script is executed
2. The script sends a tracking request with the referrer URL
3. The worker extracts the site origin from the referrer (first path segment)
4. A visitor hash is generated from the visitor's IP and User-Agent
5. The worker checks if this is a new unique visitor for the site
6. UV (unique visitors) increments only for new visitors
7. PV (page views) increments on every visit
8. The updated statistics are returned and displayed on the page

### Site Origin Tracking

For a website deployed at `xxx.github.io/yyy`:
- All pages under this path (`xxx.github.io/yyy/zzz`, `xxx.github.io/yyy/aaa`) will be tracked under the same origin: `xxx.github.io/yyy`
- UV and PV counters are aggregated at the origin level
- Multiple sites can use the same worker, each maintaining separate counters

### Privacy

- Visitor identification uses SHA-256 hash of IP + User-Agent
- No cookies or localStorage are used
- No personal information is stored
- Only aggregated statistics are maintained

### Cross-Origin Policy Support

Stateflare supports loading by websites with strict cross-origin policies (COOP/COEP). The tracking script (`track.js`) includes the necessary headers:
- `Cross-Origin-Resource-Policy: cross-origin` - Allows the script to be loaded by any website
- `Access-Control-Allow-Origin: *` - CORS support for cross-origin requests

This ensures the tracking script can be embedded in websites using Cross-Origin Embedder Policy (COEP) and Cross-Origin Opener Policy (COOP) for enhanced security.

### Documentation

- [Deployment Guide](DEPLOYMENT.md)
- [中文部署指南](DEPLOYMENT.zh-CN.md)

### Development

```bash
# Run locally with development server
pnpm run dev

# Run tests
pnpm test

# Deploy to production
pnpm run deploy
```

### License

Apache-2.0 License

---

## 中文

[![部署到 Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yuchanns/stateflare)

### 功能特点

- **UV（独立访客）**：基于 IP + User-Agent 哈希的独立访客统计（永久去重）
- **PV（页面浏览量）**：统计总页面浏览次数（每次访问递增）
- **多站点支持**：每个站点来源维护独立的 UV/PV 计数器
- **隐私保护**：使用哈希值识别访客，无需 Cookie 或 localStorage
- **可扩展**：基于 Cloudflare Workers 和 D1 数据库
- **简单集成**：只需添加一行脚本标签到您的网站

### 快速开始

#### 1. 前置要求

- Cloudflare 账号
- 安装 Node.js 和 pnpm
- 安装 Wrangler CLI：`pnpm install -g wrangler`

#### 2. 设置

```bash
# 克隆仓库
git clone https://github.com/yuchanns/stateflare.git
cd stateflare

# 安装依赖
pnpm install

# 登录 Cloudflare
wrangler login

# 创建 D1 数据库
wrangler d1 create stateflare-db

# 使用上面输出的 database_id 更新 wrangler.toml
# 将 wrangler.toml 中的 database_id 替换为实际的 ID

# 运行数据库迁移
wrangler d1 migrations apply stateflare-db

# 部署到 Cloudflare Workers
wrangler deploy
```

#### 3. 使用方法

在您的网站中添加以下代码：

```html
<script defer src="https://你的-worker.workers.dev/track.js"></script>
<label id="uv_label">UV</label> /
<label id="pv_label">PV</label>
```

将 `你的-worker.workers.dev` 替换为您实际的 Cloudflare Worker URL。

### API 接口

#### GET /track.js
返回应嵌入到您网站中的跟踪脚本。

#### POST /track
内部接口，由跟踪脚本用于记录访问。

#### GET /stats?site=<站点来源>
查询特定站点来源的统计信息。

**注意**：`site` 参数应匹配提取的站点来源（域名 + 第一个路径段）。例如，如果您的站点在 `example.com/blog`，则使用 `https://example.com/blog`。

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

### 工作原理

1. 当访客加载您的页面时，执行 `track.js` 脚本
2. 脚本发送带有来源 URL 的跟踪请求
3. Worker 从来源 URL 中提取站点根路径（第一个路径段）
4. 使用访客的 IP 和 User-Agent 生成访客哈希值
5. Worker 检查这是否是该站点的新独立访客
6. UV（独立访客）仅对新访客递增
7. PV（页面浏览量）每次访问都递增
8. 返回更新后的统计数据并显示在页面上

### 站点来源跟踪

对于部署在 `xxx.github.io/yyy` 的网站：
- 该路径下的所有页面（`xxx.github.io/yyy/zzz`、`xxx.github.io/yyy/aaa`）都将被统计到同一来源：`xxx.github.io/yyy`
- UV 和 PV 计数器在来源级别聚合
- 多个站点可以使用同一个 Worker，每个站点维护独立的计数器

### 隐私保护

- 访客识别使用 IP + User-Agent 的 SHA-256 哈希
- 不使用 Cookie 或 localStorage
- 不存储个人信息
- 仅维护聚合统计信息

### 跨源策略支持

Stateflare 支持被设置了严格跨源策略（COOP/COEP）的网站加载。跟踪脚本（`track.js`）包含必要的响应头：
- `Cross-Origin-Resource-Policy: cross-origin` - 允许任何网站加载该脚本
- `Access-Control-Allow-Origin: *` - 支持跨源请求的 CORS

这确保跟踪脚本可以被使用跨源嵌入器策略（COEP）和跨源开启器策略（COOP）以增强安全性的网站嵌入。

### 文档

- [Deployment Guide](DEPLOYMENT.md)（英文部署指南）
- [中文部署指南](DEPLOYMENT.zh-CN.md)

### 开发

```bash
# 使用开发服务器本地运行
pnpm run dev

# 运行测试
pnpm test

# 部署到生产环境
pnpm run deploy
```

### 许可证

Apache-2.0 License
