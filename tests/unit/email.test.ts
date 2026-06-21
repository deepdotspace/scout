import { describe, it, expect } from 'vitest'
import { renderIssueEmail, esc, type EmailIssue } from '../../src/lib/email'
import type { IssueSection } from '../../src/lib/report-shape'

const SECTIONS: IssueSection[] = [
  {
    headline: 'A real headline about shipping',
    summary: 'Two sentences of grounded summary. No fluff, real specifics.',
    sourceName: 'theverge.com',
    sourceUrl: 'https://www.theverge.com/2026/6/17/shipping',
    publishedAt: '2026-06-17',
  },
  {
    headline: 'Second story with a different source',
    summary: 'Another grounded summary that a busy human would actually read.',
    sourceName: 'arstechnica.com',
    sourceUrl: 'https://arstechnica.com/gadgets/2026/06/thing',
  },
]

const ISSUE: EmailIssue = {
  title: 'This Week in Shipping',
  lead: 'A tight lead that sets up the issue in one honest paragraph.',
  sections: SECTIONS,
}

function render() {
  return renderIssueEmail({
    issue: ISSUE,
    newsletterTitle: 'Shipping Weekly',
    issueNumber: 4,
    generatedAt: Date.parse('2026-06-18T12:00:00Z'),
    manageLink: 'https://scout.app.space/n/nl_123',
  })
}

describe('renderIssueEmail', () => {
  it('renders the title, lead, and the newsletter kicker', () => {
    const html = render()
    expect(html).toContain('This Week in Shipping')
    expect(html).toContain('A tight lead that sets up the issue')
    expect(html).toContain('Shipping Weekly')
    expect(html).toContain('Issue 4')
  })

  it('renders every section headline and summary', () => {
    const html = render()
    for (const s of SECTIONS) {
      expect(html).toContain(s.headline)
      expect(html).toContain(s.summary)
    }
  })

  it('links every section to its REAL source url (no fabricated links)', () => {
    const html = render()
    for (const s of SECTIONS) {
      expect(html).toContain(`href="${s.sourceUrl}"`)
      expect(html).toContain(s.sourceName)
    }
  })

  it('has a working footer manage/pause link', () => {
    const html = render()
    expect(html).toContain('href="https://scout.app.space/n/nl_123"')
    expect(html).toMatch(/manage or pause/i)
  })

  it('is table-based with inline styles and a complete html document', () => {
    const html = render()
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('role="presentation"')
    expect(html).toContain('style="') // inline styles present
    expect(html).toContain('</html>')
  })

  it('contains NO em dashes anywhere in the output', () => {
    const html = render()
    expect(html).not.toContain('—') // em dash
    expect(html).not.toContain('–') // en dash too
  })

  it('keeps the flare color on source links (font stacks must not break the style attribute)', () => {
    const html = render()
    // The link must carry the flare color inline. A double quote inside the font
    // stack would close style="..." early and drop the color; assert it is intact.
    expect(html).toContain('color:#ff8a3d;text-decoration:none;')
    // No double-quoted font names inside the style attributes (they use single quotes).
    expect(html).not.toContain('"Segoe UI"')
    expect(html).not.toContain('"Iowan Old Style"')
  })

  it('escapes HTML in issue content so titles cannot break the markup', () => {
    const evil: EmailIssue = {
      title: 'A <script>alert(1)</script> & "quoted" title',
      lead: 'Lead with <b>tags</b> & ampersands.',
      sections: [{ ...SECTIONS[0], headline: 'Head <em>line</em>' }],
    }
    const html = renderIssueEmail({
      issue: evil,
      newsletterTitle: 'X',
      manageLink: 'https://scout.app.space/n/x',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
  })

  it('esc() escapes the five HTML-significant characters', () => {
    expect(esc('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;\'&lt;/a&gt;')
  })
})
