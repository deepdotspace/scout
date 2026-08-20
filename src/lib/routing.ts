/**
 * The root routing rule: which branch src/pages/_app.tsx mounts for a given path
 * and auth state. Kept pure and out of the component so the rule is readable in
 * one place and unit-testable without a React renderer.
 *
 * Three destinations exist for a request:
 *   - the public landing (no shell, no gate),
 *   - the gated studio (AuthGate + AppShell),
 *   - a redirect from the app root to the landing when signed out.
 *
 * The last one is the entry rule. `/` doubles as the app root AND the URL people
 * share, so a signed-out visitor there is far more likely to be a first-time
 * reader than someone who lost a session. They get the landing, and "Open the
 * studio" is what raises the sign-in overlay.
 *
 * Every OTHER gated path (`/issues`, `/n/:id`, `/settings`, the 404 catch-all)
 * keeps the sign-in overlay in place. Those are deep links with a destination
 * worth preserving: the overlay renders at the requested URL, and AuthGate mounts
 * the real page at that same URL once the session flips, so the visitor lands
 * where they meant to. Redirecting them to the landing would throw that away and
 * force a return-path mechanism to win it back.
 */

/** The one public, shell-less, ungated route. */
export const PUBLIC_PATH = '/welcome'

/** The app root (the desk). The only gated path that redirects when signed out. */
export const ROOT_PATH = '/'

export type RootBranch =
  /** Auth has not resolved yet. Decide nothing: no redirect, no gate, no flash. */
  | 'boot'
  /** The public landing: bare Outlet, no AppShell, no AuthGate. */
  | 'public'
  /** Signed-out visitor at the root: send them to the landing, not the overlay. */
  | 'redirect-public'
  /** The gated studio. Signed out here means the SDK sign-in overlay, in place. */
  | 'gated'

export interface RootRouteState {
  /** `useLocation().pathname` */
  pathname: string
  /** `useAuth().isLoaded` — false until the session has resolved. */
  isLoaded: boolean
  /** `useAuth().isSignedIn` — only meaningful once `isLoaded` is true. */
  isSignedIn: boolean
}

/** Trailing slashes are the same route to the router, so they must be to us too. */
function normalizePath(pathname: string): string {
  if (typeof pathname !== 'string' || pathname === '') return ROOT_PATH
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? ROOT_PATH : trimmed
}

/**
 * Resolves the branch. Order matters:
 *   1. The landing is public, so it renders whatever the session says (and it is
 *      the redirect target, which is what keeps the redirect from looping).
 *   2. Nothing else is decided before auth resolves. Redirecting on an unresolved
 *      session would bounce a signed-in owner to the landing and back.
 *   3. Signed out at the root -> the landing.
 *   4. Everything else -> the gate.
 */
export function resolveRootBranch({ pathname, isLoaded, isSignedIn }: RootRouteState): RootBranch {
  const path = normalizePath(pathname)

  if (path === PUBLIC_PATH) return 'public'
  if (!isLoaded) return 'boot'
  if (!isSignedIn && path === ROOT_PATH) return 'redirect-public'
  return 'gated'
}
