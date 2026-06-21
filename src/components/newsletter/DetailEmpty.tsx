/**
 * DetailEmpty: the back-issues empty state (DESIGN_V2.md section 5, shot
 * 03-newsletter-empty). A centered elevated card with a serif italic "No issues
 * yet.", a short teaching line, and a "File the first issue" accent CTA. No dead
 * ends: from here you can always send the first issue out.
 */

import { Play } from 'lucide-react'
import { Card } from '../scout/Card'
import { Button } from '../scout/Button'

export function DetailEmpty({
  title,
  onFile,
  filing,
  disabled,
}: {
  /** The newsletter name, woven into the teaching line. */
  title: string
  onFile: () => void
  filing: boolean
  disabled: boolean
}) {
  return (
    <Card elevated className="px-8 py-16 text-center">
      <p
        className="font-serif italic"
        style={{ fontSize: '26px', fontWeight: 400, color: 'var(--ink)' }}
      >
        No issues yet.
      </p>
      <p className="mx-auto mt-3 max-w-[40ch] text-[14px]" style={{ lineHeight: 1.6, color: 'var(--ink2)' }}>
        Laila has not been out for {title} yet. File it now and you will have your first
        issue in about a minute.
      </p>
      <div className="mt-7 flex justify-center">
        <Button variant="primary" onClick={onFile} loading={filing} disabled={disabled}>
          <Play />
          File the first issue
        </Button>
      </div>
    </Card>
  )
}
