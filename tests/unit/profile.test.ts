import { describe, it, expect } from 'vitest'
import {
  mergeList,
  mergeProfile,
  parseExtraction,
  profileFromRow,
  profileToRow,
  emptyProfile,
  FACTS_CAP,
  INTERESTS_CAP,
  ENTRY_MAX_CHARS,
  type ReaderProfile,
} from '../../src/lib/profile'

describe('mergeList (FIFO cap + case-insensitive dedupe)', () => {
  it('appends new entries', () => {
    expect(mergeList(['a'], ['b', 'c'], 10)).toEqual(['a', 'b', 'c'])
  })

  it('dedupes case-insensitively against existing and within the additions', () => {
    expect(mergeList(['Climate Tech'], ['climate tech', 'AI policy', 'ai policy'], 10)).toEqual([
      'Climate Tech',
      'AI policy',
    ])
  })

  it('drops the oldest when over the cap (FIFO)', () => {
    const existing = Array.from({ length: 10 }, (_, i) => `f${i}`)
    const out = mergeList(existing, ['f10', 'f11'], 10)
    expect(out).toHaveLength(10)
    expect(out[0]).toBe('f2') // f0, f1 dropped from the front
    expect(out[out.length - 1]).toBe('f11')
  })

  it('trims each entry to the char cap and ignores empties', () => {
    const long = 'x'.repeat(ENTRY_MAX_CHARS + 50)
    const out = mergeList([], [long, '   ', ''], 10)
    expect(out).toHaveLength(1)
    expect(out[0]).toHaveLength(ENTRY_MAX_CHARS)
  })
})

describe('mergeProfile (caps live in code, not the model)', () => {
  const base: ReaderProfile = { displayName: 'Maya', facts: ['fact a'], interests: ['ai policy'] }

  it('reports no change when the extraction adds nothing new', () => {
    const { profile, changed } = mergeProfile(base, {
      addFacts: ['fact a'], // duplicate
      addInterests: ['AI Policy'], // duplicate, different case
    })
    expect(changed).toBe(false)
    expect(profile.facts).toEqual(['fact a'])
    expect(profile.interests).toEqual(['ai policy'])
  })

  it('reports change and merges when something durable is new', () => {
    const { profile, changed } = mergeProfile(base, {
      addFacts: ['reads on the train'],
      addInterests: ['climate tech'],
      tonePref: 'short, no fluff',
    })
    expect(changed).toBe(true)
    expect(profile.facts).toEqual(['fact a', 'reads on the train'])
    expect(profile.interests).toEqual(['ai policy', 'climate tech'])
    expect(profile.tonePref).toBe('short, no fluff')
    expect(profile.displayName).toBe('Maya') // preserved when not overwritten
  })

  it('overwrites displayName and tonePref, never appends them', () => {
    const { profile, changed } = mergeProfile(base, {
      displayName: 'M',
      addFacts: [],
      addInterests: [],
    })
    expect(changed).toBe(true)
    expect(profile.displayName).toBe('M')
  })

  it('caps facts at FACTS_CAP and interests at INTERESTS_CAP, oldest dropped', () => {
    const full: ReaderProfile = {
      facts: Array.from({ length: FACTS_CAP }, (_, i) => `f${i}`),
      interests: Array.from({ length: INTERESTS_CAP }, (_, i) => `i${i}`),
    }
    const { profile } = mergeProfile(full, { addFacts: ['new fact'], addInterests: ['new interest'] })
    expect(profile.facts).toHaveLength(FACTS_CAP)
    expect(profile.facts[profile.facts.length - 1]).toBe('new fact')
    expect(profile.facts).not.toContain('f0')
    expect(profile.interests).toHaveLength(INTERESTS_CAP)
    expect(profile.interests[profile.interests.length - 1]).toBe('new interest')
    expect(profile.interests).not.toContain('i0')
  })
})

describe('parseExtraction (tolerates the model)', () => {
  it('reads a clean JSON object', () => {
    const e = parseExtraction('{"displayName":"Maya","addFacts":["x"],"addInterests":["y"],"tonePref":"dry"}')
    expect(e).toEqual({ displayName: 'Maya', addFacts: ['x'], addInterests: ['y'], tonePref: 'dry' })
  })

  it('defaults to empty arrays on junk or missing fields', () => {
    expect(parseExtraction('not json')).toEqual({
      displayName: undefined,
      addFacts: [],
      addInterests: [],
      tonePref: undefined,
    })
    expect(parseExtraction('{}').addFacts).toEqual([])
  })

  it('drops non-string array entries', () => {
    const e = parseExtraction('{"addFacts":["ok", 1, null, "two"]}')
    expect(e.addFacts).toEqual(['ok', 'two'])
  })
})

describe('profileFromRow / profileToRow round trip', () => {
  it('reads a stored row back into a ReaderProfile', () => {
    const p = profileFromRow({
      displayName: 'Maya',
      facts: ['a', 'b'],
      interests: ['c'],
      tonePref: 'dry',
    })
    expect(p).toEqual({ displayName: 'Maya', facts: ['a', 'b'], interests: ['c'], tonePref: 'dry' })
  })

  it('tolerates a missing or malformed row as an empty profile', () => {
    expect(profileFromRow(null)).toEqual(emptyProfile())
    expect(profileFromRow({ facts: 'oops', interests: 5 } as unknown as Record<string, unknown>)).toEqual(
      emptyProfile(),
    )
  })

  it('serializes back to row columns with string defaults for the optional fields', () => {
    const row = profileToRow({ facts: ['a'], interests: [] })
    expect(row).toEqual({ displayName: '', facts: ['a'], interests: [], tonePref: '' })
  })
})
