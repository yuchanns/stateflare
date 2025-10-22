import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
}

// Generate a hash from IP and User-Agent for visitor identification
async function generateVisitorHash(ip: string, userAgent: string): Promise<string> {
  const data = `${ip}:${userAgent}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Extract site origin from referrer
// For URLs like example.com/path/subpath, extracts example.com/path/
// For URLs like example.com, extracts example.com
function getSiteOrigin(referrer: string): string | null {
  if (!referrer) return null;
  
  try {
    const url = new URL(referrer);
    const pathSegments = url.pathname.split('/').filter(seg => seg.length > 0);
    
    // If there are path segments, include only the first one (base path) with trailing slash
    // This handles cases like github.io/username/repo -> tracks at github.io/username/
    // Both github.io/username and github.io/username/ are normalized to github.io/username/
    if (pathSegments.length > 0) {
      return `${url.origin}/${pathSegments[0]}/`;
    }
    
    // No path segments, just use origin
    return url.origin;
  } catch (e) {
    return null;
  }
}

// Track visitor and update UV/PV stats
async function trackVisitor(db: D1Database, siteOrigin: string, visitorHash: string): Promise<{ uv: number; pv: number }> {
  try {
    // Check if visitor exists for this site
    const visitor = await db.prepare(
      'SELECT * FROM visitors WHERE site_origin = ? AND visitor_hash = ?'
    ).bind(siteOrigin, visitorHash).first();

    let isNewVisitor = false;

    if (!visitor) {
      // New visitor - insert
      await db.prepare(
        'INSERT INTO visitors (site_origin, visitor_hash, visit_count) VALUES (?, ?, 1)'
      ).bind(siteOrigin, visitorHash).run();
      isNewVisitor = true;
    } else {
      // Existing visitor - update visit count and last visit
      await db.prepare(
        'UPDATE visitors SET visit_count = visit_count + 1, last_visit = strftime(\'%s\', \'now\') WHERE site_origin = ? AND visitor_hash = ?'
      ).bind(siteOrigin, visitorHash).run();
    }

    // Update or create site stats
    const siteStats = await db.prepare(
      'SELECT * FROM site_stats WHERE site_origin = ?'
    ).bind(siteOrigin).first();

    if (!siteStats) {
      // Create new site stats
      await db.prepare(
        'INSERT INTO site_stats (site_origin, uv, pv) VALUES (?, 1, 1)'
      ).bind(siteOrigin).run();
      return { uv: 1, pv: 1 };
    } else {
      // Update existing stats
      const uvIncrement = isNewVisitor ? 1 : 0;
      await db.prepare(
        'UPDATE site_stats SET uv = uv + ?, pv = pv + 1, updated_at = strftime(\'%s\', \'now\') WHERE site_origin = ?'
      ).bind(uvIncrement, siteOrigin).run();

      return {
        uv: (siteStats.uv as number) + uvIncrement,
        pv: (siteStats.pv as number) + 1
      };
    }
  } catch (error) {
    console.error('Error tracking visitor:', error);
    throw error;
  }
}

// Get current stats for a site
async function getStats(db: D1Database, siteOrigin: string): Promise<{ uv: number; pv: number } | null> {
  const stats = await db.prepare(
    'SELECT uv, pv FROM site_stats WHERE site_origin = ?'
  ).bind(siteOrigin).first();

  if (!stats) return null;

  return {
    uv: stats.uv as number,
    pv: stats.pv as number
  };
}

// Generate track.js script
function generateTrackScript(workerUrl: string): string {
  return `(function() {
  var referrer = document.referrer || window.location.href;
  var trackUrl = '${workerUrl}/track';
  
  // Send tracking request
  fetch(trackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      referrer: referrer
    })
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    // Update UV/PV labels if they exist
    var uvLabel = document.getElementById('uv_label');
    var pvLabel = document.getElementById('pv_label');
    
    if (uvLabel && data.uv) {
      uvLabel.textContent = 'UV: ' + data.uv;
    }
    if (pvLabel && data.pv) {
      pvLabel.textContent = 'PV: ' + data.pv;
    }
  })
  .catch(function(error) {
    console.error('Failed to track visitor:', error);
  });
})();`;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use('*', cors());

// Root endpoint
app.get('/', (c) => {
  return c.text('Stateflare - Visitor Counter Service');
});

// Serve track.js script
app.get('/track.js', (c) => {
  const workerUrl = new URL(c.req.url).origin;
  const script = generateTrackScript(workerUrl);
  
  return c.text(script, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=3600',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
});

// Handle tracking endpoint
app.post('/track', async (c) => {
  try {
    // Get visitor IP (Cloudflare provides this)
    const ip = c.req.header('CF-Connecting-IP') || 
               c.req.header('X-Forwarded-For') || 
               'unknown';
    
    // Get User-Agent
    const userAgent = c.req.header('User-Agent') || 'unknown';
    
    // Get referrer from request body or header
    let referrer = c.req.header('Referer') || c.req.header('Referrer');
    
    try {
      const body = await c.req.json<{ referrer?: string }>();
      if (body.referrer) {
        referrer = body.referrer;
      }
    } catch (e) {
      // If body parsing fails, use header referrer
    }

    if (!referrer) {
      return c.json({ error: 'No referrer provided' }, 400);
    }

    // Extract site origin
    const siteOrigin = getSiteOrigin(referrer);
    if (!siteOrigin) {
      return c.json({ error: 'Invalid referrer' }, 400);
    }

    // Generate visitor hash
    const visitorHash = await generateVisitorHash(ip, userAgent);

    // Track the visitor
    const stats = await trackVisitor(c.env.DB, siteOrigin, visitorHash);

    return c.json(stats);
  } catch (error) {
    console.error('Error in track endpoint:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Handle stats query endpoint
app.get('/stats', async (c) => {
  const siteOrigin = c.req.query('site');
  
  if (!siteOrigin) {
    return c.json({ error: 'Site parameter required' }, 400);
  }

  try {
    const stats = await getStats(c.env.DB, siteOrigin);
    
    if (!stats) {
      return c.json({ uv: 0, pv: 0 });
    }

    return c.json(stats);
  } catch (error) {
    console.error('Error in stats endpoint:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
