# Stateflare

A lightweight visitor counter that runs on your own Cloudflare Workers with D1 database storage.

## Features

- **UV (Unique Visitors)**: Tracks unique visitors based on IP + User-Agent hash (permanent deduplication)
- **PV (Page Views)**: Counts total page views (increments on each visit)
- **Multi-site Support**: Each site origin maintains its own separate UV/PV counters
- **Privacy-Focused**: Uses hashed visitor identification, no cookies or localStorage
- **Scalable**: Powered by Cloudflare Workers and D1 database
- **Easy Integration**: Just add a single script tag to your website

## Quick Start

### 1. Prerequisites

- A Cloudflare account
- Node.js and npm installed
- Wrangler CLI installed: `npm install -g wrangler`

### 2. Setup

```bash
# Clone the repository
git clone https://github.com/yuchanns/stateflare.git
cd stateflare

# Install dependencies
npm install

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

### 3. Usage

Add the following code to your website:

```html
<script defer src="https://your-worker.workers.dev/track.js"></script>
<label id="uv_label">UV</label> /
<label id="pv_label">PV</label>
```

Replace `your-worker.workers.dev` with your actual Cloudflare Worker URL.

## API Endpoints

### GET /track.js
Returns the tracking script that should be embedded in your website.

### POST /track
Internal endpoint used by the tracking script to record visits.

### GET /stats?site=<site_origin>
Query statistics for a specific site origin.

**Example:**
```bash
curl "https://your-worker.workers.dev/stats?site=https://example.com"
```

**Response:**
```json
{
  "uv": 123,
  "pv": 456
}
```

## How It Works

1. When a visitor loads your page, the `track.js` script is executed
2. The script sends a tracking request with the referrer URL
3. The worker extracts the site origin from the referrer
4. A visitor hash is generated from the visitor's IP and User-Agent
5. The worker checks if this is a new unique visitor for the site
6. UV (unique visitors) increments only for new visitors
7. PV (page views) increments on every visit
8. The updated statistics are returned and displayed on the page

## Site Origin Tracking

For a website deployed at `xxx.github.io/yyy`:
- All pages under this path (`xxx.github.io/yyy/zzz`, `xxx.github.io/yyy/aaa`) will be tracked under the same origin: `xxx.github.io/yyy`
- UV and PV counters are aggregated at the origin level
- Multiple sites can use the same worker, each maintaining separate counters

## Privacy

- Visitor identification uses SHA-256 hash of IP + User-Agent
- No cookies or localStorage are used
- No personal information is stored
- Only aggregated statistics are maintained

## Development

```bash
# Run locally with development server
npm run dev

# Deploy to production
npm run deploy
```

## License

MIT License
