/**
 * ScoutToast: the single centered confirmation pill (DESIGN_V2.md section 6, shot
 * 22-home-toast). One pill at a time, bottom-centered, --toast-bg with an accent
 * dot + a short message, auto-dismiss ~2.6s. Used for every reversible action
 * (paused, starred, archived, filed, created) so an action confirms without a
 * modal.
 *
 * Usage: wrap the app in <ScoutToastProvider>, then in any screen:
 *   const { showToast } = useScoutToast()
 *   showToast('Northwind Watch is live again.')
 *
 * This is intentionally minimal (a single string). It is separate from the
 * scaffold's stacked useToast (components/ui), which screens may still use for
 * richer success/error notices.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ScoutToastValue {
  showToast: (message: string) => void
}

const Ctx = createContext<ScoutToastValue | null>(null)

export function ScoutToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(msg)
    timer.current = setTimeout(() => setMessage(null), 2600)
  }, [])

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 z-[120] flex justify-center"
          style={{ bottom: '26px' }}
        >
          <div
            className="flex items-center gap-2.5 rounded-full px-4 py-2.5"
            style={{
              background: 'var(--toast-bg)',
              color: 'var(--toast-ink)',
              boxShadow: '0 18px 50px -16px rgba(20,12,2,.5)',
              animation: 'sct-up 0.18s ease-out',
            }}
          >
            <span className="size-2 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden />
            <span className="font-sans" style={{ fontSize: '13.5px', fontWeight: 500 }}>
              {message}
            </span>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useScoutToast(): ScoutToastValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useScoutToast must be used within ScoutToastProvider')
  return ctx
}
