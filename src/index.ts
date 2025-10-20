import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
}

// Extract site origin from referrer
// For URLs like example.com/path/subpath, extracts example.com/path
// For URLs like example.com, extracts example.com
function getSiteOrigin(referrer: string): string | null {
  if (!referrer) return null;
  
  try {
    const url = new URL(referrer);
    const pathSegments = url.pathname.split('/').filter(seg => seg.length > 0);
    
    // If there are path segments, include only the first one (base path)
    // This handles cases like github.io/username/repo -> tracks at github.io/username
    if (pathSegments.length > 0) {
      return `${url.origin}/${pathSegments[0]}`;
    }
    
    // No path segments, just use origin
    return url.origin;
  } catch (e) {
    return null;
  }
}

// Update UV/PV stats without storing visitor data
async function updateStats(db: D1Database, siteOrigin: string): Promise<{ uv: number; pv: number }> {
  try {
    // Update or create site stats - just increment PV
    const siteStats = await db.prepare(
      'SELECT * FROM site_stats WHERE site_origin = ?'
    ).bind(siteOrigin).first();

    if (!siteStats) {
      // Create new site stats - first visit counts as both UV and PV
      await db.prepare(
        'INSERT INTO site_stats (site_origin, uv, pv) VALUES (?, 1, 1)'
      ).bind(siteOrigin).run();
      return { uv: 1, pv: 1 };
    } else {
      // Update existing stats - only increment PV
      // UV stays the same since we're not tracking individual visitors
      await db.prepare(
        'UPDATE site_stats SET pv = pv + 1, updated_at = strftime(\'%s\', \'now\') WHERE site_origin = ?'
      ).bind(siteOrigin).run();

      return {
        uv: siteStats.uv as number,
        pv: (siteStats.pv as number) + 1
      };
    }
  } catch (error) {
    console.error('Error updating stats:', error);
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
  });
});

// Handle tracking endpoint
app.post('/track', async (c) => {
  try {
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

    // Update stats (no visitor tracking)
    const stats = await updateStats(c.env.DB, siteOrigin);

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
