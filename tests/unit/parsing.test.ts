import { describe, it, expect } from 'vitest'
import {
  tryParseJsonLenient,
  parseComposeOutput,
  isHttpUrl,
} from '../../src/lib/report-shape'

// The lenient extractor is the shared parse path for queryGen, relevanceJudge,
// scoutsRead, AND compose. These cases mirror what models actually emit.
describe('tryParseJsonLenient (query / judge / compose share this path)', () => {
  it('parses clean JSON', () => {
    expect(tryParseJsonLenient('{"a":1}')).toEqual({ a: 1 })
    expect(tryParseJsonLenient('["a","b"]')).toEqual(['a', 'b'])
  })

  it('strips a ```json code fence (common Haiku habit)', () => {
    const text = '```json\n["ai coding tools 2026","cursor vs copilot"]\n```'
    expect(tryParseJsonLenient(text)).toEqual(['ai coding tools 2026', 'cursor vs copilot'])
  })

  it('extracts the first balanced array out of stray prose (judge output)', () => {
    const text = 'Here are the verdicts:\n[{"i":0,"score":0.9,"duplicateOf":null}]\nDone.'
    expect(tryParseJsonLenient(text)).toEqual([{ i: 0, score: 0.9, duplicateOf: null }])
  })

  it('does not get fooled by braces inside quoted strings', () => {
    const text = '{"q":"what about {curly} braces?"}'
    expect(tryParseJsonLenient(text)).toEqual({ q: 'what about {curly} braces?' })
  })

  it('returns null on unrecoverable input rather than throwing', () => {
    expect(tryParseJsonLenient('not json at all')).toBeNull()
    expect(tryParseJsonLenient('')).toBeNull()
    expect(tryParseJsonLenient(null)).toBeNull()
  })
})

describe('isHttpUrl (no fabricated or unsafe links reach the reader)', () => {
  it('accepts http(s)', () => {
    expect(isHttpUrl('https://example.com/a')).toBe(true)
    expect(isHttpUrl('http://example.com')).toBe(true)
  })
  it('rejects non-http schemes and non-urls', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,x')).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
    expect(isHttpUrl(undefined)).toBe(false)
  })
})

describe('parseComposeOutput (the crown-jewel compose parse)', () => {
  const good = JSON.stringify({
    title: 'AI coding tools, week of June 16',
    lead: 'Two releases this week changed how agents edit code.',
    sections: [
      {
        headline: 'Cursor ships background agents',
        summary: 'Cursor added agents that run edits off the main thread.',
        sourceName: 'Cursor blog',
        sourceUrl: 'https://cursor.com/blog/agents',
        publishedAt: '2026-06-15',
      },
      {
        headline: 'A headline with no real link',
        summary: 'This story has a fabricated source url and must be dropped.',
        sourceName: 'Nowhere',
        sourceUrl: 'not-a-url',
      },
    ],
  })

  it('parses a valid issue and keeps the section with a real url', () => {
    const issue = parseComposeOutput(good)
    expect(issue).not.toBeNull()
    expect(issue!.title).toContain('AI coding tools')
    expect(issue!.lead.length).toBeGreaterThan(0)
    expect(issue!.sections).toHaveLength(1)
    expect(issue!.sections[0].sourceUrl).toBe('https://cursor.com/blog/agents')
    expect(issue!.sections[0].publishedAt).toBe('2026-06-15')
  })

  it('parses through a code fence too', () => {
    expect(parseComposeOutput('```json\n' + good + '\n```')).not.toBeNull()
  })

  it('fills sourceName from the host when the model omits it', () => {
    const text = JSON.stringify({
      title: 'T',
      lead: 'L',
      sections: [
        { headline: 'H', summary: 'S', sourceUrl: 'https://www.theverge.com/x' },
      ],
    })
    const issue = parseComposeOutput(text)
    expect(issue!.sections[0].sourceName).toBe('theverge.com')
  })

  it('returns null when no section has a usable source url', () => {
    const text = JSON.stringify({
      title: 'T',
      lead: 'L',
      sections: [{ headline: 'H', summary: 'S', sourceUrl: 'javascript:bad' }],
    })
    expect(parseComposeOutput(text)).toBeNull()
  })

  it('returns null on missing title or lead', () => {
    expect(parseComposeOutput('{"title":"","lead":"x","sections":[]}')).toBeNull()
    expect(parseComposeOutput('garbage')).toBeNull()
  })

  // Belt to the prompt's suspenders: even when the model slips in em / en dashes,
  // the parsed issue (which both the web view and the email render from) carries
  // none. Em dash U+2014, en dash U+2013, built from code points so this file
  // stays free of the characters it tests.
  it('strips em and en dashes from every user-visible field', () => {
    const EM = '—'
    const EN = '–'
    const text = JSON.stringify({
      title: `AI coding ${EM} the week that shipped`,
      lead: `Two releases ${EM} both real ${EM} changed how agents edit code.`,
      sections: [
        {
          headline: `Cursor cut 10${EN}20% of latency`,
          summary: `Cursor added agents ${EM} a real change ${EM} this week.`,
          sourceName: 'Cursor blog',
          sourceUrl: 'https://cursor.com/blog/agents',
        },
      ],
    })
    const issue = parseComposeOutput(text)
    expect(issue).not.toBeNull()
    const fields = [
      issue!.title,
      issue!.lead,
      issue!.sections[0].headline,
      issue!.sections[0].summary,
    ]
    for (const f of fields) {
      expect(f).not.toContain(EM)
      expect(f).not.toContain(EN)
    }
    // The substitutions read naturally and the numeric range keeps a hyphen.
    expect(issue!.title).toBe('AI coding, the week that shipped')
    expect(issue!.lead).toBe('Two releases, both real, changed how agents edit code.')
    expect(issue!.sections[0].headline).toBe('Cursor cut 10-20% of latency')
    expect(issue!.sections[0].summary).toBe('Cursor added agents, a real change, this week.')
  })
})
