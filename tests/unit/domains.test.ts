import { describe, it, expect } from 'vitest'
import { normalizeDomain, normalizeDomains, parseDomainList } from '../../src/lib/domains'

describe('normalizeDomain', () => {
  it('drops a bare token with no TLD (the "x" bug that 400s Exa)', () => {
    expect(normalizeDomain('x')).toBeNull()
    expect(normalizeDomain('reddit')).toBeNull()
    expect(normalizeDomain('localhost')).toBeNull()
  })

  it('keeps real domains', () => {
    expect(normalizeDomain('x.com')).toBe('x.com')
    expect(normalizeDomain('arxiv.org')).toBe('arxiv.org')
    expect(normalizeDomain('news.ycombinator.com')).toBe('news.ycombinator.com')
    expect(normalizeDomain('example.co.uk')).toBe('example.co.uk')
  })

  it('strips scheme, www, path, query, port, and trailing dot', () => {
    expect(normalizeDomain('https://www.X.com/foo?bar=1')).toBe('x.com')
    expect(normalizeDomain('http://example.com:8080/a/b')).toBe('example.com')
    expect(normalizeDomain('WWW.OpenAI.COM')).toBe('openai.com')
    expect(normalizeDomain('example.com.')).toBe('example.com')
    expect(normalizeDomain('  Reddit.com  ')).toBe('reddit.com')
  })

  it('drops junk, IPs, and non-strings', () => {
    expect(normalizeDomain('foo bar')).toBeNull()
    expect(normalizeDomain('.com')).toBeNull()
    expect(normalizeDomain('example.')).toBeNull()
    expect(normalizeDomain('1.2.3.4')).toBeNull()
    expect(normalizeDomain('')).toBeNull()
    expect(normalizeDomain(42 as unknown as string)).toBeNull()
  })
})

describe('normalizeDomains', () => {
  it('cleans, drops invalid, and dedupes order-stable', () => {
    expect(normalizeDomains(['x', 'x.com', 'https://x.com/', 'foo'])).toEqual(['x.com'])
    expect(normalizeDomains(['A.com', 'b.org', 'a.com'])).toEqual(['a.com', 'b.org'])
  })

  it('returns [] for the empty / all-invalid cases (so forums still run)', () => {
    expect(normalizeDomains([])).toEqual([])
    expect(normalizeDomains(undefined)).toEqual([])
    expect(normalizeDomains(['x'])).toEqual([])
  })
})

describe('normalizeDomain — RFC 1123 label rules', () => {
  it('drops labels with a leading or trailing hyphen (Exa 400s on these)', () => {
    expect(normalizeDomain('-reddit.com')).toBeNull()
    expect(normalizeDomain('reddit-.com')).toBeNull()
    expect(normalizeDomain('-.com')).toBeNull()
    expect(normalizeDomain('--.com')).toBeNull()
    expect(normalizeDomain('a-.b-.com')).toBeNull()
    expect(normalizeDomain('sub.-bad.com')).toBeNull()
  })

  it('still keeps hyphens inside a label', () => {
    expect(normalizeDomain('news-site.com')).toBe('news-site.com')
    expect(normalizeDomain('my-blog.co.uk')).toBe('my-blog.co.uk')
    expect(normalizeDomain('a-b-c.dev')).toBe('a-b-c.dev')
  })
})

describe('parseDomainList', () => {
  it('splits on whitespace, not just commas (the field-wiping bug)', () => {
    expect(parseDomainList('arxiv.org openai.com')).toEqual(['arxiv.org', 'openai.com'])
    expect(parseDomainList('arxiv.org, openai.com')).toEqual(['arxiv.org', 'openai.com'])
    expect(parseDomainList('arxiv.org; openai.com')).toEqual(['arxiv.org', 'openai.com'])
    expect(parseDomainList('arxiv.org|openai.com')).toEqual(['arxiv.org', 'openai.com'])
    expect(parseDomainList('arxiv.org\nopenai.com')).toEqual(['arxiv.org', 'openai.com'])
  })

  it('handles list-ish paste shapes and stray punctuation', () => {
    expect(parseDomainList('- reddit.com\n- medium.com')).toEqual(['reddit.com', 'medium.com'])
    expect(parseDomainList('  arxiv.org   ')).toEqual(['arxiv.org'])
    expect(parseDomainList('')).toEqual([])
  })

  it('still drops entries with no real TLD', () => {
    expect(parseDomainList('x openai.com')).toEqual(['openai.com'])
  })
})
