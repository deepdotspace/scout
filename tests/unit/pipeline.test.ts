import { describe, it, expect } from 'vitest'
import { dedupeByUrl, siftVerdicts, buildSourcesBlock } from '../../src/lib/pipeline'
import type { SourceItem } from '../../src/lib/sources'
import type { JudgeVerdict } from '../../src/lib/ai'
import { resolvePersona, PERSONAS } from '../../src/personas'
import { buildComposePrompt } from '../../src/prompts'

function src(url: string, opts: Partial<SourceItem> = {}): SourceItem {
  return {
    url,
    title: opts.title ?? url,
    text: opts.text ?? '',
    publishedAt: opts.publishedAt ?? null,
    source: opts.source ?? 'exa',
    sourceName: opts.sourceName ?? 'web',
  }
}

describe('dedupeByUrl', () => {
  it('collapses duplicate urls, keeping the longer-text copy', () => {
    const items = [
      src('https://a.com', { text: 'short' }),
      src('https://b.com', { text: 'b' }),
      src('https://a.com', { text: 'a much longer body that should win' }),
    ]
    const out = dedupeByUrl(items)
    expect(out).toHaveLength(2)
    expect(out.find((i) => i.url === 'https://a.com')!.text).toContain('longer body')
  })

  it('drops items with an empty url', () => {
    expect(dedupeByUrl([src(''), src('https://x.com')])).toHaveLength(1)
  })
})

describe('siftVerdicts', () => {
  const items = [
    src('https://a.com', { publishedAt: '2026-06-10' }),
    src('https://b.com', { publishedAt: '2026-06-15' }),
    src('https://c.com'),
  ]

  it('drops candidates below the score threshold', () => {
    const verdicts: JudgeVerdict[] = [
      { score: 0.9, duplicateOf: null },
      { score: 0.2, duplicateOf: null }, // below 0.55 threshold
      { score: 0.6, duplicateOf: null },
    ]
    const kept = siftVerdicts(items, verdicts)
    expect(kept.map((k) => k.url)).toEqual(['https://a.com', 'https://c.com'])
  })

  it('orders by score, then recency on a tie', () => {
    const verdicts: JudgeVerdict[] = [
      { score: 0.8, duplicateOf: null }, // a, older
      { score: 0.8, duplicateOf: null }, // b, newer
      { score: 0.95, duplicateOf: null }, // c, highest
    ]
    const kept = siftVerdicts(items, verdicts)
    expect(kept.map((k) => k.url)).toEqual(['https://c.com', 'https://b.com', 'https://a.com'])
  })

  it('drops the lower-scoring half of a flagged duplicate pair', () => {
    const verdicts: JudgeVerdict[] = [
      { score: 0.9, duplicateOf: null },
      { score: 0.6, duplicateOf: 0 }, // b duplicates a, lower score -> b dropped
      { score: 0.7, duplicateOf: null },
    ]
    const kept = siftVerdicts(items, verdicts)
    expect(kept.map((k) => k.url)).toEqual(['https://a.com', 'https://c.com'])
  })
})

describe('resolvePersona', () => {
  it('returns the preset fragment for a known preset', () => {
    expect(resolvePersona('analyst', undefined)).toBe(PERSONAS.analyst.fragment)
  })
  it('passes a custom voice through verbatim', () => {
    expect(resolvePersona('custom', 'Wry and brief.')).toBe('Wry and brief.')
  })
  it('falls back to a default for an unknown or empty preset', () => {
    expect(resolvePersona('nonsense', undefined)).toBe(PERSONAS.companion.fragment)
    expect(resolvePersona('custom', '   ')).toBe(PERSONAS.companion.fragment)
  })
})

describe('prompt + sources hygiene', () => {
  it('the compose prompt carries no em dashes', () => {
    const prompt = buildComposePrompt(PERSONAS.analyst.fragment, ['more on infra', 'less startup gossip'])
    expect(prompt).not.toContain('—') // em dash
    expect(prompt).toContain('more on infra')
    expect(prompt).toContain('Sharp and dense')
  })

  it('buildSourcesBlock numbers stories and includes the real url', () => {
    const block = buildSourcesBlock([
      src('https://x.com/post', { title: 'A real post', sourceName: 'x.com', text: 'body' }),
    ])
    expect(block).toContain('[1] A real post')
    expect(block).toContain('URL: https://x.com/post')
  })
})
