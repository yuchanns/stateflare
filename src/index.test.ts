import { describe, it, expect } from 'vitest';
import app from './index';

// Test the site origin extraction logic
function getSiteOrigin(referrer: string): string | null {
  if (!referrer) return null;
  
  try {
    const url = new URL(referrer);
    const pathSegments = url.pathname.split('/').filter(seg => seg.length > 0);
    
    if (pathSegments.length > 0) {
      return `${url.origin}/${pathSegments[0]}`;
    }
    
    return url.origin;
  } catch (e) {
    return null;
  }
}

describe('getSiteOrigin', () => {
  it('should extract origin with first path segment for GitHub Pages-style URLs', () => {
    expect(getSiteOrigin('https://xxx.github.io/yyy/zzz')).toBe('https://xxx.github.io/yyy');
    expect(getSiteOrigin('https://xxx.github.io/yyy/aaa')).toBe('https://xxx.github.io/yyy');
    expect(getSiteOrigin('https://xxx.github.io/yyy')).toBe('https://xxx.github.io/yyy');
  });

  it('should handle URLs without path segments', () => {
    expect(getSiteOrigin('https://example.com')).toBe('https://example.com');
    expect(getSiteOrigin('https://example.com/')).toBe('https://example.com');
  });

  it('should handle various domain structures', () => {
    expect(getSiteOrigin('https://blog.example.com/posts/article')).toBe('https://blog.example.com/posts');
    expect(getSiteOrigin('https://example.com/blog/2024/01/post')).toBe('https://example.com/blog');
  });

  it('should return null for invalid URLs', () => {
    expect(getSiteOrigin('')).toBe(null);
    expect(getSiteOrigin('not-a-url')).toBe(null);
  });

  it('should handle URLs with query parameters and fragments', () => {
    expect(getSiteOrigin('https://example.com/blog?page=1')).toBe('https://example.com/blog');
    expect(getSiteOrigin('https://example.com/blog#section')).toBe('https://example.com/blog');
    expect(getSiteOrigin('https://example.com/blog/post?id=123#comments')).toBe('https://example.com/blog');
  });
});

// Test visitor hash generation
async function generateVisitorHash(ip: string, userAgent: string): Promise<string> {
  const data = `${ip}:${userAgent}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

describe('generateVisitorHash', () => {
  it('should generate consistent hashes for same input', async () => {
    const hash1 = await generateVisitorHash('192.168.1.1', 'Mozilla/5.0');
    const hash2 = await generateVisitorHash('192.168.1.1', 'Mozilla/5.0');
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different IPs', async () => {
    const hash1 = await generateVisitorHash('192.168.1.1', 'Mozilla/5.0');
    const hash2 = await generateVisitorHash('192.168.1.2', 'Mozilla/5.0');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate different hashes for different user agents', async () => {
    const hash1 = await generateVisitorHash('192.168.1.1', 'Mozilla/5.0');
    const hash2 = await generateVisitorHash('192.168.1.1', 'Chrome/90.0');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate 64-character hex string', async () => {
    const hash = await generateVisitorHash('192.168.1.1', 'Mozilla/5.0');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// Test COOP/COEP headers
describe('COOP/COEP Support', () => {
  it('should include Cross-Origin-Resource-Policy header for track.js', async () => {
    const res = await app.request('/track.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
  });

  it('should include CORS headers for track.js', async () => {
    const res = await app.request('/track.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should include correct Content-Type for track.js', async () => {
    const res = await app.request('/track.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/javascript');
  });
});
