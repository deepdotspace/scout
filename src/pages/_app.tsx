/**
 * App: global providers + the shell / public-route split.
 *
 * Generouted renders this around all routes. The layering is:
 *   providers -> AuthBoot (data layer) -> EITHER the public landing OR the gated studio.
 *
 * Auth model. The studio (the desk, beats, issues, settings, the companion) is a
 * single-owner app: every studio route mounts only when signed in, behind the SDK
 * AuthGate. The ONE exception is the public marketing landing at `/welcome`: it
 * renders OUTSIDE the AuthGate and OUTSIDE the AppShell so a logged-out visitor
 * sees the press-wire landing with no sign-in wall. This un-gates only the static
 * landing UI; it does NOT un-gate any data. The worker APIs stay owner-gated
 * server-side, and the landing reads no records, so a signed-out visitor sees the
 * page and nothing private. "Open the studio" on the landing then triggers the SDK
 * sign-in flow (or goes straight to the desk if already signed in).
 *
 * The data layer (AuthBoot -> RecordProvider allowAnonymous) wraps both branches so
 * the providers/context tree is stable across a sign-in transition.
 */

import { Suspense, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuth, AuthGate } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { ToastProvider } from '../components/ui'
import { AppShell } from '../components/scout/AppShell'
import { ScoutMark, ScoutToastProvider } from '../components/scout'
import { AccentModeProvider } from '../theme/accent'
import { SCOPE_ID } from '../constants'
import { schemas } from '../schemas'

/** The one public, shell-less, ungated route. Everything else stays owner-gated. */
const PUBLIC_PATH = '/welcome'

export default function App() {
  return (
    <AccentModeProvider>
      <ScoutToastProvider>
        <ToastProvider>
          <DeepSpaceAuthProvider>
            <AuthBoot>
              {/* data-testid="app-root" is the canonical "app shell mounted" hook
                  every test relies on. Don't rename without updating templates/tests. */}
              <div
                data-testid="app-root"
                className="h-screen overflow-hidden"
                style={{ background: 'var(--bg)', color: 'var(--ink)' }}
              >
                <RootRoutes />
              </div>
            </AuthBoot>
          </DeepSpaceAuthProvider>
        </ToastProvider>
      </ScoutToastProvider>
    </AccentModeProvider>
  )
}

/**
 * Splits the public landing from the gated studio by path. The landing renders the
 * Outlet bare (its own sticky nav, no sidebar, no AuthGate). Every other route
 * mounts inside the AuthGate + AppShell, so a signed-out visitor there still sees
 * the sign-in overlay and the studio stays owner-gated.
 */
function RootRoutes() {
  const { pathname } = useLocation()
  const isPublic = pathname === PUBLIC_PATH

  if (isPublic) {
    return (
      <div className="h-full overflow-y-auto">
        <Suspense fallback={<BootScreen />}>
          <Outlet />
        </Suspense>
      </div>
    )
  }

  return (
    <AuthGate redirectOnSignOut={PUBLIC_PATH}>
      <AppShell>
        <Suspense fallback={<BootScreen />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </AuthGate>
  )
}

function BootScreen() {
  return (
    <div className="flex h-full items-center justify-center">
      <ScoutMark size={28} className="animate-pulse" />
    </div>
  )
}

/** Waits for auth to resolve, then mounts the data layer. Distinct from the SDK's `AuthGate`. */
function AuthBoot({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <RecordProvider allowAnonymous>
      <RecordScope roomId={SCOPE_ID} schemas={schemas}>
        {children}
      </RecordScope>
    </RecordProvider>
  )
}
