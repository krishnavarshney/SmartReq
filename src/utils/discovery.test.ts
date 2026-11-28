import { describe, it, expect } from 'vitest';
import { normalizeBaseUrl, resolveLink, findLinksLocally, resourceOf, canonicalUrl } from './discovery';

describe('normalizeBaseUrl', () => {
  it('accepts http(s) URLs and adds a scheme when missing', () => {
    expect(normalizeBaseUrl('http://localhost:4010/users/1')).toEqual({ url: 'http://localhost:4010/users/1' });
    expect(normalizeBaseUrl('api.example.com/v1')).toEqual({ url: 'https://api.example.com/v1' });
    expect(normalizeBaseUrl('localhost:4010/users')).toEqual({ url: 'http://localhost:4010/users' });
  });
  it('rejects empty, malformed and non-http input', () => {
    expect('error' in normalizeBaseUrl('')).toBe(true);
    expect('error' in normalizeBaseUrl('ftp://x.com')).toBe(true);
    expect('error' in normalizeBaseUrl('not a url')).toBe(true);
    expect('error' in normalizeBaseUrl('https://intranet')).toBe(true);
  });
});

describe('link resolution', () => {
  const from = 'http://localhost:4010/users/1';
  it('resolves relative links on the same origin and drops others', () => {
    expect(resolveLink('/users/2', from)).toBe('http://localhost:4010/users/2');
    expect(resolveLink('posts', from)).toBe('http://localhost:4010/users/posts');
    expect(resolveLink('https://evil.com/x', from)).toBeNull();
    expect(resolveLink('/logo.png', from)).toBeNull();
    expect(resolveLink('/users/{id}', from)).toBeNull();
    expect(resolveLink('mailto:a@b.c', from)).toBeNull();
  });
  it('canonicalises trailing slashes and hashes', () => {
    expect(canonicalUrl('http://h.io/a/#x')).toBe('http://h.io/a');
    expect(canonicalUrl('http://h.io/')).toBe('http://h.io/');
  });
  it('finds path-like strings in JSON and hrefs in HTML', () => {
    const json = { next: '/users/2', self: 'http://localhost:4010/users/1', name: 'Ada', nested: [{ href: '/posts/9' }], other: 'https://x.com/a' };
    expect(findLinksLocally(json, from).sort()).toEqual(['http://localhost:4010/posts/9', 'http://localhost:4010/users/1', 'http://localhost:4010/users/2']);
    expect(findLinksLocally('<a href="/docs">d</a><img src="/a.png">', from)).toEqual(['http://localhost:4010/docs']);
  });
  it('groups by first path segment', () => {
    expect(resourceOf('http://h.io/users/1/posts')).toBe('users');
    expect(resourceOf('http://h.io/')).toBe('/');
  });
});
