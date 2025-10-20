# Deployment Guide

This guide will help you deploy Stateflare to Cloudflare Workers.

## Prerequisites

1. A Cloudflare account (free tier is sufficient)
2. Node.js (v16 or higher) and npm installed
3. Git installed

## Step-by-Step Deployment

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Clone and Setup

```bash
git clone https://github.com/yuchanns/stateflare.git
cd stateflare
npm install
```

### 3. Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

### 4. Create D1 Database

```bash
wrangler d1 create stateflare-db
```

You will see output like:

```
✅ Successfully created DB 'stateflare-db'!

[[d1_databases]]
binding = "DB"
database_name = "stateflare-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 5. Update Configuration

Copy the `database_id` from the output above and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "stateflare-db"
database_id = "your-actual-database-id-here"  # Replace this
```

### 6. Run Database Migrations

```bash
wrangler d1 migrations apply stateflare-db
```

This creates the necessary tables in your D1 database.

### 7. Deploy the Worker

```bash
wrangler deploy
```

After deployment, you'll see output like:

```
✨  Build succeeded!
✨  Successfully published your script to
   https://stateflare.your-subdomain.workers.dev
```

### 8. Test the Deployment

Visit your worker URL in a browser:
```
https://stateflare.your-subdomain.workers.dev
```

You should see: "Stateflare - Visitor Counter Service"

Test the tracking script:
```
https://stateflare.your-subdomain.workers.dev/track.js
```

This should return the JavaScript tracking code.

## Local Development

### Start Development Server

```bash
npm run dev
```

For local development, you'll need to use a local D1 database:

```bash
wrangler d1 migrations apply stateflare-db --local
```

Then run:
```bash
wrangler dev
```

## Configuration Options

### Custom Worker Name

To use a custom worker name, update `wrangler.toml`:

```toml
name = "my-custom-name"
```

### Custom Domain

To use a custom domain:

1. Add your domain to Cloudflare
2. In the Cloudflare dashboard, go to Workers & Pages
3. Select your worker
4. Go to Settings > Triggers
5. Add a custom domain

## Usage in Your Website

After deployment, add this to your HTML:

```html
<script defer src="https://your-worker.workers.dev/track.js"></script>
<label id="uv_label">UV</label> /
<label id="pv_label">PV</label>
```

Replace `your-worker.workers.dev` with your actual worker URL.

## Troubleshooting

### Database Connection Issues

If you get database connection errors, verify:
1. The database_id in wrangler.toml is correct
2. Migrations have been applied: `wrangler d1 migrations list stateflare-db`
3. The database exists: `wrangler d1 list`

### CORS Issues

If you get CORS errors in the browser console, check:
1. The worker is deployed and accessible
2. Your website is using HTTPS (Cloudflare Workers requires HTTPS)

### Rate Limiting

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request

For high-traffic sites, consider upgrading to the paid Workers plan.

## Updating

To update your deployment:

```bash
git pull
npm install
wrangler deploy
```

## Monitoring

View logs in real-time:

```bash
wrangler tail
```

View database contents:

```bash
wrangler d1 execute stateflare-db --command "SELECT * FROM site_stats"
```

## Security

- Visitor identification uses SHA-256 hash of IP + User-Agent
- No personal information is stored directly
- D1 database is private and only accessible through your Worker
- CORS is enabled for tracking from any origin

## Cost Estimation

Cloudflare Workers Free Tier:
- 100,000 requests/day
- 10ms CPU time per request
- D1: 5GB storage, 5 million reads/day, 100,000 writes/day

For most small to medium websites, the free tier is sufficient.
