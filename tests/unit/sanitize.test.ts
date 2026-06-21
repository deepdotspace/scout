import { describe, it, expect } from 'vitest'
import { stripDashes } from '../../src/lib/sanitize'

// Em dash U+2014, en dash U+2013, horizontal bar U+2015. Built from code points
// so the source file itself stays free of the characters it bans.
const EM = '—'
const EN = '–'
const BAR = '―'

// stripDashes is the deterministic guarantee behind the prompt's no-dash rule:
// a model slip never reaches the reader. It must read naturally and never leave
// broken punctuation.
describe('stripDashes (the no-dash guarantee)', () => {
  it('turns an em dash in prose into a comma with no doubled punctuation', () => {
    const out = stripDashes(`The release${EM}a big one${EM}shipped today.`)
    expect(out).toBe('The release, a big one, shipped today.')
    expect(out).not.toContain(EM)
    expect(out).not.toMatch(/,,|, ,| ,/)
  })

  it('handles a spaced em dash the same way', () => {
    const out = stripDashes(`Cursor shipped agents ${EM} a real change ${EM} this week.`)
    expect(out).toBe('Cursor shipped agents, a real change, this week.')
    expect(out).not.toContain(EM)
    expect(out).not.toMatch(/ {2,}/)
  })

  it('turns a numeric en-dash range into a plain hyphen', () => {
    expect(stripDashes(`cut 10${EN}20% of staff`)).toBe('cut 10-20% of staff')
    expect(stripDashes(`pages 100 ${EN} 200`)).toBe('pages 100-200')
  })

  it('turns a non-numeric en dash into a comma', () => {
    const out = stripDashes(`the plan ${EN} their plan ${EN} differs`)
    expect(out).toBe('the plan, their plan, differs')
    expect(out).not.toContain(EN)
  })

  it('treats the horizontal bar like an em dash', () => {
    expect(stripDashes(`one${BAR}two`)).toBe('one, two')
  })

  it('drops a leading or trailing dash without leaving a stray comma', () => {
    expect(stripDashes(`${EM}leading note`)).toBe('leading note')
    expect(stripDashes(`trailing note ${EM}`)).toBe('trailing note')
  })

  it('leaves a string with no dashes unchanged', () => {
    const clean = 'A plain sentence (with a parenthetical) and a hyphen-word.'
    expect(stripDashes(clean)).toBe(clean)
    expect(stripDashes('')).toBe('')
  })
})
