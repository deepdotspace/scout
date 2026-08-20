import { describe, it, expect } from 'vitest'
import { resolveRootBranch, PUBLIC_PATH, ROOT_PATH } from '../../src/lib/routing'

// The root routing rule from src/pages/_app.tsx, tested as a pure decision.
// The three states a visitor can be in are auth-not-resolved, signed out, signed in.

const booting = { isLoaded: false, isSignedIn: false }
const signedOut = { isLoaded: true, isSignedIn: false }
const signedIn = { isLoaded: true, isSignedIn: true }

/** Every gated studio path that is NOT the root. */
const DEEP_LINKS = [
  '/issues',
  '/new',
  '/settings',
  '/n/abc123',
  '/n/abc123/edit',
  '/n/abc123/run',
  '/n/abc123/i/issue-1',
  '/does-not-exist', // the [...all].tsx 404 catch-all
]

describe('resolveRootBranch: the signed-out entry rule', () => {
  it('sends a signed-out visitor at the root to the landing', () => {
    expect(resolveRootBranch({ pathname: ROOT_PATH, ...signedOut })).toBe('redirect-public')
  })

  it('leaves a signed-in owner at the root on the gated desk', () => {
    expect(resolveRootBranch({ pathname: ROOT_PATH, ...signedIn })).toBe('gated')
  })

  it('does not redirect before auth resolves (the flicker guard)', () => {
    // Deciding on an unresolved session would bounce a signed-in owner to the
    // landing and back on every cold load.
    expect(resolveRootBranch({ pathname: ROOT_PATH, ...booting })).toBe('boot')
    expect(resolveRootBranch({ pathname: '/issues', ...booting })).toBe('boot')
  })
})

describe('resolveRootBranch: deep links keep the sign-in overlay', () => {
  it.each(DEEP_LINKS)('%s stays gated when signed out, so the destination survives', (path) => {
    expect(resolveRootBranch({ pathname: path, ...signedOut })).toBe('gated')
  })

  it.each(DEEP_LINKS)('%s stays gated when signed in', (path) => {
    expect(resolveRootBranch({ pathname: path, ...signedIn })).toBe('gated')
  })
})

describe('resolveRootBranch: the landing is public in every session state', () => {
  it('renders the landing signed out, signed in, and mid-boot', () => {
    expect(resolveRootBranch({ pathname: PUBLIC_PATH, ...signedOut })).toBe('public')
    expect(resolveRootBranch({ pathname: PUBLIC_PATH, ...signedIn })).toBe('public')
    expect(resolveRootBranch({ pathname: PUBLIC_PATH, ...booting })).toBe('public')
  })

  it('cannot loop: the redirect target resolves to the public branch', () => {
    const first = resolveRootBranch({ pathname: ROOT_PATH, ...signedOut })
    expect(first).toBe('redirect-public')
    // What the redirect lands on, in the same (still signed-out) session.
    expect(resolveRootBranch({ pathname: PUBLIC_PATH, ...signedOut })).toBe('public')
  })
})

describe('resolveRootBranch: path normalization', () => {
  it('treats a trailing slash as the same route', () => {
    expect(resolveRootBranch({ pathname: '/welcome/', ...signedOut })).toBe('public')
    expect(resolveRootBranch({ pathname: '/welcome//', ...signedIn })).toBe('public')
    expect(resolveRootBranch({ pathname: '//', ...signedOut })).toBe('redirect-public')
  })

  it('falls back to the root for an empty path', () => {
    expect(resolveRootBranch({ pathname: '', ...signedOut })).toBe('redirect-public')
    expect(resolveRootBranch({ pathname: '', ...signedIn })).toBe('gated')
  })

  it('does not match a path that merely starts with the public path', () => {
    expect(resolveRootBranch({ pathname: '/welcome-back', ...signedOut })).toBe('gated')
    expect(resolveRootBranch({ pathname: '/welcome/extra', ...signedOut })).toBe('gated')
  })
})
