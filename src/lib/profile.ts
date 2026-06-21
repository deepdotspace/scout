/**
 * Reader profile: Laila's one durable "who is this reader" memory.
 *
 * This is the deterministic half of the memory write. A cheap Haiku call (in
 * worker.ts, in waitUntil) reads the latest exchange and returns what it
 * learned; THIS file bounds it. The caps + dedupe live here in code, never in
 * the model: a reader who chats for a year ends up with ~20 facts, not 20,000.
 *
 * FIFO + case-insensitive dedupe + a hard cap is the whole "don't grow forever"
 * answer. No embeddings, no scoring, no decay. (See AGENT_SYSTEM.md section 3.)
 */

import type { ReaderProfile } from '../prompts'
import { tryParseJsonLenient } from './report-shape'

export type { ReaderProfile }

/** Hard caps. A long-lived profile stays small and legible. */
export const FACTS_CAP = 20
export const INTERESTS_CAP = 12
/** Each fact / interest is a short string; long ones are trimmed before storing. */
export const ENTRY_MAX_CHARS = 140

/** The shape the extraction call returns: only durable, worth-remembering deltas. */
export interface ProfileExtraction {
  displayName?: string
  addFacts: string[]
  addInterests: string[]
  tonePref?: string
}

/** An empty profile (used when no row exists yet). */
export function emptyProfile(): ReaderProfile {
  return { facts: [], interests: [] }
}

/** Parse a raw profile row's data into a ReaderProfile, tolerating bad shapes. */
export function profileFromRow(data: Record<string, unknown> | null | undefined): ReaderProfile {
  if (!data) return emptyProfile()
  return {
    displayName: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : undefined,
    facts: asStringArray(data.facts),
    interests: asStringArray(data.interests),
    tonePref: typeof data.tonePref === 'string' && data.tonePref.trim() ? data.tonePref.trim() : undefined,
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
}

function cleanEntry(s: string): string {
  return s.trim().slice(0, ENTRY_MAX_CHARS).trim()
}

/**
 * Append new entries to an existing list with case-insensitive dedupe and a
 * hard FIFO cap: when over the cap, the oldest entries drop off the front.
 * Empty / whitespace entries are ignored.
 */
export function mergeList(existing: string[], additions: string[], cap: number): string[] {
  const out = [...existing]
  const seen = new Set(out.map((s) => s.toLowerCase()))
  for (const raw of additions) {
    const entry = cleanEntry(raw)
    if (!entry) continue
    const key = entry.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out.length > cap ? out.slice(out.length - cap) : out
}

/**
 * Merge an extraction into the current profile under the caps + dedupe. Returns
 * the merged profile and whether anything actually changed, so the caller only
 * writes the row when there is a real delta (most turns write nothing).
 */
export function mergeProfile(
  current: ReaderProfile,
  extraction: ProfileExtraction,
): { profile: ReaderProfile; changed: boolean } {
  const facts = mergeList(current.facts, extraction.addFacts, FACTS_CAP)
  const interests = mergeList(current.interests, extraction.addInterests, INTERESTS_CAP)
  const displayName =
    extraction.displayName?.trim() ? cleanEntry(extraction.displayName) : current.displayName
  const tonePref = extraction.tonePref?.trim() ? cleanEntry(extraction.tonePref) : current.tonePref

  const changed =
    facts.length !== current.facts.length ||
    interests.length !== current.interests.length ||
    facts.some((f, i) => f !== current.facts[i]) ||
    interests.some((it, i) => it !== current.interests[i]) ||
    displayName !== current.displayName ||
    tonePref !== current.tonePref

  return { profile: { displayName, facts, interests, tonePref }, changed }
}

/** Coerce the model's JSON into a ProfileExtraction, dropping anything malformed. */
export function parseExtraction(text: string | null | undefined): ProfileExtraction {
  const parsed = tryParseJsonLenient(text)
  const o = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  return {
    displayName: typeof o.displayName === 'string' && o.displayName.trim() ? o.displayName.trim() : undefined,
    addFacts: asStringArray(o.addFacts),
    addInterests: asStringArray(o.addInterests),
    tonePref: typeof o.tonePref === 'string' && o.tonePref.trim() ? o.tonePref.trim() : undefined,
  }
}

/** The columns written to the profile row (the envelope carries timestamps). */
export function profileToRow(profile: ReaderProfile): Record<string, unknown> {
  return {
    displayName: profile.displayName ?? '',
    facts: profile.facts,
    interests: profile.interests,
    tonePref: profile.tonePref ?? '',
  }
}
