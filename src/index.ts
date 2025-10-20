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
function getSiteOrigin(referrer: string): string | null {
  if (!referrer) return null;
  
  try {
    const url = new URL(referrer);
    // Get the origin and pathname up to the root
    return `${url.origin}${url.pathname}`.replace(/\/$/, '');
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve track.js script
    if (path === '/track.js') {
      const workerUrl = url.origin;
      const script = generateTrackScript(workerUrl);
      
      return new Response(script, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/javascript',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Handle tracking endpoint
    if (path === '/track' && request.method === 'POST') {
      try {
        // Get visitor IP (Cloudflare provides this)
        const ip = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown';
        
        // Get User-Agent
        const userAgent = request.headers.get('User-Agent') || 'unknown';
        
        // Get referrer from request body or header
        let referrer = request.headers.get('Referer') || request.headers.get('Referrer');
        
        try {
          const body = await request.json() as { referrer?: string };
          if (body.referrer) {
            referrer = body.referrer;
          }
        } catch (e) {
          // If body parsing fails, use header referrer
        }

        if (!referrer) {
          return new Response(JSON.stringify({ error: 'No referrer provided' }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }

        // Extract site origin
        const siteOrigin = getSiteOrigin(referrer);
        if (!siteOrigin) {
          return new Response(JSON.stringify({ error: 'Invalid referrer' }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }

        // Generate visitor hash
        const visitorHash = await generateVisitorHash(ip, userAgent);

        // Track the visitor
        const stats = await trackVisitor(env.DB, siteOrigin, visitorHash);

        return new Response(JSON.stringify(stats), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Error in track endpoint:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Handle stats query endpoint
    if (path === '/stats' && request.method === 'GET') {
      const siteOrigin = url.searchParams.get('site');
      
      if (!siteOrigin) {
        return new Response(JSON.stringify({ error: 'Site parameter required' }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      try {
        const stats = await getStats(env.DB, siteOrigin);
        
        if (!stats) {
          return new Response(JSON.stringify({ uv: 0, pv: 0 }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }

        return new Response(JSON.stringify(stats), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Error in stats endpoint:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Default response
    return new Response('Stateflare - Visitor Counter Service', {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
      },
    });
  },
};
