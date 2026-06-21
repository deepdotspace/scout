/**
 * FieldRadar: the hand-drawn radar at the heart of "Laila is in the field".
 *
 * A faithful React port of the prototype's `_drawField()` (Scout.dc.html): a
 * 300x300 dpr-aware <canvas> redrawn every frame on requestAnimationFrame. Each
 * frame paints three concentric rings + axes, a rotating accent sweep of 28
 * fading spokes while Laila scans and reads, 64 particles that appear as sources
 * are found, brighten while reading, fade as duplicates drop in the sift, and
 * four "kept" particles that pulse in the accent and draw lines to the center
 * node once filing begins. The brand glyph spins slowly over the center.
 *
 * Honesty: the radar is driven by the real phase (0..3) and the real FOUND/READ
 * counts the run reports. It never invents precise numbers. The particle field
 * is an honest visual of "casting wide, reading, keeping a few", not a live map
 * of specific sources, so it stays indicative the way the phase rhythm does.
 *
 * Accent is read from the live `--accent` CSS var so switching the accent (or
 * day/night) recolors the radar with no prop wiring.
 */

import { useEffect, useRef } from 'react'

/** The four particles Laila keeps. Fixed indices so the kept nodes are stable. */
const KEPT = [7, 21, 38, 55]
const PARTICLE_COUNT = 64
/** Candidate ceiling the scan fills toward (the prototype's 214-source sweep). */
const FOUND_CEILING = 214

interface Particle {
  a: number // angle
  r: number // radius fraction 0..1
  tw: number // per-particle twinkle phase
  kept: boolean
}

function makeParticles(): Particle[] {
  const arr: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    arr.push({
      a: Math.random() * Math.PI * 2,
      r: Math.sqrt(Math.random()) * 0.9 + 0.06,
      tw: Math.random(),
      kept: KEPT.indexOf(i) >= 0,
    })
  }
  return arr
}

/** Read the live accent hex from the root and return both the hex and "r,g,b". */
function readAccent(): { hex: string; rgb: string } {
  if (typeof window === 'undefined') return { hex: '#C2603D', rgb: '194,96,61' }
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  const hex = raw || '#C2603D'
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return { hex, rgb: '194,96,61' }
  return { hex, rgb: `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}` }
}

export function FieldRadar({
  phase,
  found,
  read,
  reduced = false,
  size = 300,
}: {
  /** Real pipeline phase: 0 scan, 1 read, 2 sift, 3 file. */
  phase: number
  /** Real FOUND count so far (drives which particles have appeared). */
  found: number
  /** Real READ count so far (kept for parity; phase already gates brightening). */
  read: number
  reduced?: boolean
  size?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>(makeParticles())
  // Latest values, read inside the rAF loop without re-subscribing it.
  const stateRef = useRef({ phase, found, read })
  stateRef.current = { phase, found, read }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = size
    const H = size
    const maxR = (size / 300) * 132
    const start = performance.now()
    let raf = 0

    const draw = (nowAbs: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2
      const cy = H / 2
      const { hex: acc, rgb } = readAccent()
      const { phase, found, read } = stateRef.current
      // Time is frozen under reduced motion so the radar is a calm still frame.
      const t = reduced ? 0 : (nowAbs - start) / 1000

      // rings + axes
      ctx.strokeStyle = 'rgba(255,255,255,0.055)'
      ctx.lineWidth = 1
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath()
        ctx.arc(cx, cy, (maxR * k) / 3, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'
      ctx.beginPath()
      ctx.moveTo(cx - maxR, cy)
      ctx.lineTo(cx + maxR, cy)
      ctx.moveTo(cx, cy - maxR)
      ctx.lineTo(cx, cy + maxR)
      ctx.stroke()

      // sweep while scanning/reading (a cone of fading spokes), skipped if reduced
      if (phase <= 1 && !reduced) {
        const sweepA = t * 1.9
        for (let sgi = 0; sgi < 28; sgi++) {
          const a = sweepA - sgi * 0.045
          const al = 0.18 * (1 - sgi / 28)
          ctx.strokeStyle = `rgba(${rgb},${al})`
          ctx.lineWidth = 2.2
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR)
          ctx.stroke()
        }
      }

      // particles: appear as found grows, brighten while reading, fade in the sift
      const particles = particlesRef.current
      const scannedFrac = Math.min(1, found / FOUND_CEILING)
      // Reading completeness, used to fade non-kept particles through the sift.
      const readFrac = found > 0 ? Math.min(1, read / found) : 0
      const siftProg = phase > 2 ? 1 : phase === 2 ? Math.min(1, readFrac) : 0
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const appeared = phase > 0 || i / particles.length < scannedFrac
        if (!appeared) continue
        const x = cx + Math.cos(p.a) * p.r * maxR
        const y = cy + Math.sin(p.a) * p.r * maxR

        if (p.kept) {
          if (phase >= 3) {
            ctx.strokeStyle = `rgba(${rgb},${0.22 + 0.18 * Math.sin(t * 3 + p.tw * 4)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo(x, y)
            ctx.stroke()
          }
          const pr = 3 + (phase >= 2 ? 1.4 * Math.abs(Math.sin(t * 3 + p.tw * 6)) : 0)
          ctx.fillStyle = `rgba(${rgb},0.16)`
          ctx.beginPath()
          ctx.arc(x, y, pr + 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = acc
          ctx.beginPath()
          ctx.arc(x, y, pr, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        let alpha = 0.5
        if (phase === 1) alpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 2.2 + p.tw * 7))
        if (phase >= 2) alpha = 0.45 * (1 - siftProg)
        if (alpha <= 0.015) continue
        ctx.fillStyle = `rgba(238,240,244,${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, 1.7, 0, Math.PI * 2)
        ctx.fill()
      }

      // center node (the bureau): a soft accent halo over a solid accent dot
      ctx.fillStyle = `rgba(${rgb},0.14)`
      ctx.beginPath()
      ctx.arc(cx, cy, 15, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = acc
      ctx.beginPath()
      ctx.arc(cx, cy, 8, 0, Math.PI * 2)
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [reduced, size])

  return (
    <span className="relative block" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} width={size} height={size} className="block" style={{ width: size, height: size }} />
      {/* The brand glyph spinning slowly over the center node (sct-orbit 9s). */}
      <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
        <svg
          width={30}
          height={30}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--field-bg)"
          strokeWidth={2.4}
          strokeLinecap="round"
          style={reduced ? undefined : { animation: 'sct-orbit 9s linear infinite', transformOrigin: 'center' }}
        >
          <line x1="12" y1="3.5" x2="12" y2="20.5" />
          <line x1="3.5" y1="12" x2="20.5" y2="12" />
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </span>
    </span>
  )
}
