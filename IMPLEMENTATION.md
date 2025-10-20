# Implementation Summary

This document provides a technical overview of the Stateflare UV/PV tracking implementation.

## Architecture

### Components

1. **Cloudflare Worker**: The main service that handles all requests
2. **D1 Database**: SQLite database for storing statistics
3. **Track.js Script**: Frontend JavaScript that websites embed
4. **Client Website**: The website being tracked

### Data Flow

```
User visits website → track.js loaded → POST to /track endpoint
→ Worker extracts site origin → Generate visitor hash from IP+UA
→ Check if new visitor → Update UV/PV in D1 → Return stats
→ Update labels on page
```

## Database Schema

### Table: site_stats
Stores aggregated statistics per site origin.

| Column | Type | Description |
|--------|------|-------------|
| site_origin | TEXT | Primary key, e.g., "https://example.com/blog" |
| uv | INTEGER | Unique visitor count |
| pv | INTEGER | Page view count |
| created_at | INTEGER | Unix timestamp of creation |
| updated_at | INTEGER | Unix timestamp of last update |

### Table: visitors
Tracks individual visitors for deduplication.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| site_origin | TEXT | Site this visitor belongs to |
| visitor_hash | TEXT | SHA-256 hash of IP + User-Agent |
| first_visit | INTEGER | Unix timestamp of first visit |
| last_visit | INTEGER | Unix timestamp of last visit |
| visit_count | INTEGER | Number of visits by this visitor |

**Unique Constraint**: (site_origin, visitor_hash)

## Key Algorithms

### Site Origin Extraction

**Purpose**: Extract the base path of a website to aggregate statistics.

**Algorithm**:
```typescript
1. Parse the referrer URL
2. Split pathname into segments
3. If segments exist, return origin + first segment
4. Otherwise, return just the origin
```

**Examples**:
- `https://xxx.github.io/yyy/zzz` → `https://xxx.github.io/yyy`
- `https://xxx.github.io/yyy` → `https://xxx.github.io/yyy`
- `https://example.com` → `https://example.com`
- `https://example.com/blog/posts/1` → `https://example.com/blog`

**Rationale**: GitHub Pages and similar platforms deploy sites at `/username/project`, so we track at that level.

### Visitor Hash Generation

**Purpose**: Uniquely identify visitors without storing personal data.

**Algorithm**:
```typescript
1. Concatenate IP address and User-Agent with ":"
2. Encode as UTF-8
3. Apply SHA-256 hash
4. Convert to hexadecimal string (64 characters)
```

**Properties**:
- Deterministic: Same visitor always gets same hash
- One-way: Cannot reverse to get original IP/UA
- Collision-resistant: Different visitors get different hashes
- Privacy-preserving: No PII stored

### UV/PV Update Logic

**On each visit**:
```typescript
1. Calculate visitor_hash from IP + User-Agent
2. Check if (site_origin, visitor_hash) exists in visitors table
3. If new visitor:
   - Insert into visitors table
   - Increment both UV and PV
4. If existing visitor:
   - Update last_visit timestamp
   - Increment visit_count
   - Increment only PV
5. Update site_stats table
6. Return current UV and PV
```

**Transaction Considerations**:
- Uses separate queries (D1 doesn't support full transactions yet)
- Race conditions are acceptable (eventually consistent)
- Statistics are approximate but converge to correct values

## API Endpoints

### GET /track.js

**Purpose**: Serve the tracking script

**Response**: JavaScript code that:
1. Captures current page referrer or location
2. Sends POST request to /track
3. Updates UV/PV labels on the page

**Caching**: 1 hour (3600 seconds)

### POST /track

**Purpose**: Record a page visit

**Input**:
```json
{
  "referrer": "https://example.com/blog/post"
}
```

**Process**:
1. Extract CF-Connecting-IP header (visitor IP)
2. Extract User-Agent header
3. Extract referrer from body or headers
4. Calculate site origin
5. Generate visitor hash
6. Update database
7. Return statistics

**Output**:
```json
{
  "uv": 123,
  "pv": 456
}
```

### GET /stats

**Purpose**: Query statistics for a site

**Parameters**:
- `site`: Site origin (e.g., "https://example.com/blog")

**Output**:
```json
{
  "uv": 123,
  "pv": 456
}
```

**Use Case**: External dashboards, monitoring, reporting

## Performance Considerations

### Database Indexes

- `idx_visitors_site_hash`: Fast lookup of visitors by (site_origin, visitor_hash)
- `idx_site_stats_origin`: Fast lookup of stats by site_origin

### Caching Strategy

- `/track.js` cached for 1 hour
- Stats queries not cached (always fresh)
- Worker code cached at edge

### Scalability

**D1 Limits (Free Tier)**:
- 5GB storage
- 5M reads/day
- 100K writes/day

**Worker Limits (Free Tier)**:
- 100K requests/day
- 10ms CPU time per request

**Estimated Capacity**:
- ~100K unique visitors/day
- Unlimited page views (limited by request count)
- Supports hundreds of sites on single worker

### Optimization Opportunities

1. **Batch Updates**: Accumulate stats in memory, flush periodically
2. **Read Replicas**: Cache recent stats in KV for read queries
3. **Rate Limiting**: Prevent abuse from single IPs
4. **Aggregation**: Pre-compute stats for faster queries

## Security Considerations

### Privacy

- ✅ No cookies used
- ✅ No localStorage used
- ✅ No tracking pixels
- ✅ Visitor identity hashed (irreversible)
- ✅ No cross-site tracking (each site isolated)
- ⚠️ Server can see raw IPs (but doesn't store them)

### CORS

- Allows all origins (`Access-Control-Allow-Origin: *`)
- Required for cross-origin tracking
- No authentication needed (public stats)

### Attack Vectors

1. **Bot Traffic**: No bot detection currently
   - Mitigation: Could add Cloudflare Bot Management
2. **Fake Referrers**: Can send fake referrer headers
   - Mitigation: Stats are informational only
3. **DDoS**: Could exhaust free tier limits
   - Mitigation: Cloudflare DDoS protection
4. **Data Scraping**: Stats API is public
   - Mitigation: Rate limiting could be added

## Deployment Checklist

- [ ] Create Cloudflare account
- [ ] Install Wrangler CLI
- [ ] Create D1 database
- [ ] Update wrangler.toml with database_id
- [ ] Run migrations
- [ ] Deploy worker
- [ ] Test /track.js endpoint
- [ ] Test tracking on sample page
- [ ] Verify stats in database
- [ ] Add script to production site
- [ ] Monitor logs for errors

## Troubleshooting

### Common Issues

1. **Database not found**
   - Verify database_id in wrangler.toml
   - Check database exists: `wrangler d1 list`

2. **CORS errors**
   - Ensure worker is deployed (not local)
   - Check browser console for exact error

3. **Stats not updating**
   - Check worker logs: `wrangler tail`
   - Verify referrer is being sent correctly

4. **UV/PV labels not updating**
   - Check element IDs match: `uv_label`, `pv_label`
   - Check browser console for JavaScript errors

## Future Enhancements

### Potential Features

1. **Time-based Analytics**
   - Track daily/weekly/monthly stats
   - Trending analysis

2. **Geographic Tracking**
   - Use CF-IPCountry header
   - Country-level statistics

3. **Bot Detection**
   - Filter out known bots
   - More accurate UV counts

4. **Dashboard UI**
   - Web interface to view stats
   - Charts and graphs

5. **Real-time Updates**
   - WebSocket support
   - Live counter updates

6. **Advanced Deduplication**
   - Session-based tracking
   - Configurable timeout periods

7. **Export/Import**
   - CSV export
   - Data migration tools

## Testing Strategy

### Unit Tests
- ✅ Site origin extraction
- ✅ Visitor hash generation
- ✅ URL parsing edge cases

### Integration Tests (Manual)
1. Deploy to development worker
2. Create test page with script
3. Visit from different browsers
4. Verify UV increments once per browser
5. Verify PV increments each visit
6. Check database contents

### Performance Tests
- Load test /track endpoint
- Measure response times
- Check database query performance

## Maintenance

### Monitoring

1. **Worker Metrics**
   - Request count
   - Error rate
   - CPU time

2. **Database Metrics**
   - Row count
   - Storage usage
   - Query performance

3. **Alerts**
   - Error rate > 5%
   - Approaching free tier limits

### Backup

- D1 data can be exported: `wrangler d1 export`
- Consider periodic backups for important data
- No automatic backup in free tier

### Updates

- Review Cloudflare Workers changelog
- Update dependencies regularly
- Test in development before production deploy

## License

MIT License - See LICENSE file for details.
