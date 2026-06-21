/**
 * FirstRun: the desk before any newsletter exists (DESIGN_V2.md section 5, the
 * "start your first beat" empty state). Warm and teaching, never a dead end. The
 * same time-aware greeting + mono date as the populated desk, then a single
 * elevated card that explains what a beat is in plain words and invites the one
 * action that matters: start the first beat (routes to the create flow).
 */

import { useNavigate } from 'react-router-dom'
import { ArrowRight, Compass } from 'lucide-react'
import { Button } from '../scout/Button'
import { EyebrowLabel } from '../scout/Eyebrow'
import { greeting, today } from './dateline'

export function FirstRun() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-10 md:px-10 md:py-14">
      <header className="flex items-start justify-between gap-6">
        <h1 className="font-serif" style={{ fontSize: '40px', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {greeting()}
        </h1>
        <span className="mt-2 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
          {today()}
        </span>
      </header>
      <p className="mt-2 max-w-[58ch] font-serif italic" style={{ fontSize: '19px', fontWeight: 300, lineHeight: 1.5, color: 'var(--ink2)' }}>
        Your desk is empty, which is the right place to start. Tell me one thing you want to stay on top of and I will go read the web for it.
      </p>

      <section className="mt-12">
        <EyebrowLabel>Start your first beat</EyebrowLabel>
        <div
          className="mt-4 rounded-[18px] p-8 md:p-10"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-featured)' }}
        >
          <span
            className="inline-flex size-12 items-center justify-center rounded-full [&_svg]:size-6"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)' }}
          >
            <Compass />
          </span>
          <h2 className="mt-5 max-w-[34ch] font-serif" style={{ fontSize: '26px', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.22, color: 'var(--ink)' }}>
            A beat is a topic I cover for you, on a rhythm you set.
          </h2>
          <p className="mt-3 max-w-[56ch] font-serif" style={{ fontSize: '17px', lineHeight: 1.6, color: 'var(--ink2)' }}>
            Describe it in plain words. Laila reads more of the web than you ever would, throws out the noise, and files you a sharp, sourced issue. It lands by email on your schedule, or the moment you ask. Vague is fine. We sharpen it together.
          </p>
          <div className="mt-7">
            <Button variant="primary" size="lg" onClick={() => navigate('/new')}>
              Start your first beat
              <ArrowRight />
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
