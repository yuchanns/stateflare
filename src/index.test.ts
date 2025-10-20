import { describe, it, expect } from 'vitest';

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
