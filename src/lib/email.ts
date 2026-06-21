/**
 * Render a Scout issue into a mobile-first HTML email.
 *
 * This is a SEPARATE visual world from the dark app: a light, high-readability
 * letter. Cream/white background, near-black ink, a reading serif for the body,
 * and the flare accent (#ff8a3d) used only on the title rule and on links. Email
 * clients strip <style> and most CSS, so layout is table-based and every style
 * is inline. Single column, ~600px, so it reads on a phone. No em dashes (the
 * house rule applies to generated output too).
 *
 * Written fresh rather than reusing Deepbrief's render-email.ts: that renderer
 * walks a generic ReportBlock[] tree and is themed for a dark "Dispatch"; Scout
 * has a fixed { title, lead, sections[] } shape and a light design, so the block
 * machinery would be dead weight. We keep only the discipline (esc + tables +
 * inline styles).
 */

import type { IssueSection } from './report-shape'

export interface EmailIssue {
  title: string
  lead: string
  sections: IssueSection[]
}

export interface RenderEmailInput {
  issue: EmailIssue
  /** Newsletter title, shown as the small kicker above the issue title. */
  newsletterTitle: string
  /** Issue number, e.g. 4 -> "Issue 4". Omitted from the kicker when falsy. */
  issueNumber?: number
  /** Generated-at instant for the dateline; defaults to now. */
  generatedAt?: number
  /** The newsletter page link for the footer, e.g. `<appUrl>/n/<id>`. */
  manageLink: string
}

// Light letter palette. Flare is the single accent and only appears on the
// title rule and links; everything else is ink on cream/white for readability.
const C = {
  outer: '#f3ede1', // warm letterbox behind the card
  card: '#ffffff', // the letter
  ink: '#1a1714', // near-black body text
  inkSoft: '#5c554c', // secondary text (lead, meta)
  faint: '#938b7e', // datelines, footer
  rule: '#e7e0d3', // hairline dividers
  flare: '#ff8a3d', // the one accent: title rule + links
} as const

// A reading serif for the body (echoes the app's reading surface), with a wide
// fallback stack since email clients have no web fonts. Font names use SINGLE
// quotes: these stacks are interpolated into double-quoted inline style
// attributes, and a double quote inside would close the attribute early and drop
// the rest of the style (e.g. the link color), which email clients silently honor.
const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

/** HTML-escape text so a title/summary can never break the markup or inject. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A short host label for a source url, e.g. "https://www.theverge.com/x" -> "theverge.com". */
function hostLabel(url: string, fallback: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return fallback || 'source'
  }
}

/** "June 18, 2026". Locale-stable so the dateline reads the same everywhere. */
function dateline(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const kicker = (color: string) =>
  `font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${color};`

/** One story: serif headline, serif summary, and a real source link with date. */
function renderSection(section: IssueSection): string {
  const url = section.sourceUrl
  const source = section.sourceName || hostLabel(url, 'source')
  const date = section.publishedAt ? ` &middot; ${esc(section.publishedAt)}` : ''
  return `
  <tr><td style="padding:26px 0 0;">
    <h2 style="font-family:${SERIF};font-weight:700;font-size:21px;line-height:1.3;color:${C.ink};margin:0 0 8px;">
      ${esc(section.headline)}
    </h2>
    <p style="font-family:${SERIF};font-size:16px;line-height:1.65;color:${C.ink};margin:0 0 10px;">
      ${esc(section.summary)}
    </p>
    <p style="margin:0;">
      <a href="${esc(url)}" style="font-family:${SANS};font-size:13px;font-weight:600;color:${C.flare};text-decoration:none;">
        ${esc(source)} &rarr;</a><span style="font-family:${SANS};font-size:12px;color:${C.faint};">${date}</span>
    </p>
  </td></tr>
  <tr><td style="padding:24px 0 0;"><div style="height:1px;background:${C.rule};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>`
}

/** Render the full issue to a standalone HTML document (inline styles, tables). */
export function renderIssueEmail(input: RenderEmailInput): string {
  const { issue, newsletterTitle, issueNumber, manageLink } = input
  const ts = input.generatedAt ?? Date.now()
  const kickerText = [newsletterTitle, issueNumber ? `Issue ${issueNumber}` : '']
    .filter(Boolean)
    .map(esc)
    .join(' &middot; ')

  const sections = issue.sections.map(renderSection).join('')

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(issue.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.outer};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.outer};">
    <tr><td align="center" style="padding:32px 12px 48px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.rule};border-radius:14px;">
        <tr><td style="padding:36px 32px 8px;">

          <!-- masthead -->
          <p style="${kicker(C.faint)}margin:0 0 12px;">${kickerText || esc(newsletterTitle)}</p>
          <h1 style="font-family:${SERIF};font-weight:700;font-size:30px;line-height:1.18;color:${C.ink};margin:0;">
            ${esc(issue.title)}
          </h1>
          <!-- the one flare touch: the title rule -->
          <div style="height:3px;width:44px;background:${C.flare};border-radius:2px;margin:16px 0 0;line-height:3px;font-size:1px;">&nbsp;</div>
          <p style="font-family:${SANS};font-size:12px;color:${C.faint};margin:14px 0 0;">${esc(dateline(ts))}</p>

          <!-- lead -->
          <p style="font-family:${SERIF};font-size:18px;line-height:1.6;color:${C.inkSoft};margin:22px 0 0;">
            ${esc(issue.lead)}
          </p>

          <!-- stories -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${sections}
          </table>

        </td></tr>

        <!-- footer -->
        <tr><td style="padding:8px 32px 32px;">
          <p style="font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faint};margin:0;">
            Scout put this together for you from real sources.
            <a href="${esc(manageLink)}" style="color:${C.flare};text-decoration:none;font-weight:600;">Manage or pause</a> this newsletter.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
