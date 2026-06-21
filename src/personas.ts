/**
 * The five voices, one canonical source for the whole app.
 *
 * The UI reads `label` and `sample` from here to render the voice picker; the
 * compose pipeline reads `fragment` by id to splice into the prompt. A custom
 * voice stores its own text in voiceCustomPrompt and is dropped in verbatim.
 * No em dashes anywhere (the model mimics the prompt).
 */

export type VoicePreset = 'analyst' | 'operator' | 'scholar' | 'companion' | 'storyteller' | 'custom'

type PresetId = Exclude<VoicePreset, 'custom'>

interface Persona {
  /** The named voice the user sees in the picker. */
  label: string
  /** The one-line description shown under the label on every voice card. */
  blurb: string
  /** A serif italic sample line, shown on the selected card to hear the voice. */
  sample: string
  /** The instruction spliced into the compose prompt for this voice. */
  fragment: string
}

export const PERSONAS: Record<PresetId, Persona> = {
  analyst: {
    label: 'Sharp Analyst',
    blurb: 'Direct, skeptical, names the catch. Reads like a great equity analyst.',
    sample: 'Two things actually moved this week, and they are connected.',
    fragment:
      'Sharp and dense. You write like a smart colleague briefing a peer: confident, precise, no hand-holding. Connect dots between stories when it adds real insight.',
  },
  operator: {
    label: 'Executive Brief',
    blurb: 'Fast and flat. Bottom line first, three bullets, done.',
    sample: 'Bottom line first: ship the migration before Friday. Here is why.',
    fragment:
      'An executive brief, the fastest possible read. Lead with the takeaway, then bullet-tight stories. The reader is busy and wants the so-what immediately.',
  },
  scholar: {
    label: 'Precise Academic',
    blurb: 'Careful and caveated, cites everything, trusts you with nuance.',
    sample: 'The result is established. The interpretation around it is not, yet.',
    fragment:
      'Precise and citation-forward. Distinguish what is established from what is claimed. Measured tone, exact language, careful with certainty.',
  },
  companion: {
    label: 'Warm Companion',
    blurb: 'Like a sharp friend who read everything so you did not have to.',
    sample: 'I read all of it so you did not have to. Here is what actually matters.',
    fragment:
      'Warm and plain, like a friend who read everything so they did not have to. Clear, human, a little personality. Never cutesy, never dumbed down.',
  },
  storyteller: {
    label: 'Storyteller',
    blurb: 'Finds the narrative and a little color, never at the cost of the facts.',
    sample: 'One thread runs through all of it this week. Let me pull you along it.',
    fragment:
      'Find the thread connecting the stories and pull the reader through it. Narrative momentum, but every claim still tied to a real source.',
  },
}

/** The presets in picker order, plus their id. The UI maps over this. */
export const VOICE_OPTIONS: ReadonlyArray<{
  id: PresetId
  label: string
  blurb: string
  sample: string
  fragment: string
}> = (['analyst', 'operator', 'scholar', 'companion', 'storyteller'] as const).map((id) => ({
  id,
  ...PERSONAS[id],
}))

/** The default preset preselected in the setup form (a user can skip the step). */
export const DEFAULT_VOICE_PRESET: PresetId = 'analyst'

const DEFAULT_FRAGMENT = PERSONAS.companion.fragment

/** The display label for any stored voicePreset (custom or unknown -> "Custom voice"). */
export function voiceLabel(preset: string | undefined): string {
  return PERSONAS[preset as PresetId]?.label ?? 'Custom voice'
}

/**
 * Resolve the voice fragment for a newsletter. A custom preset uses the reader's
 * own voice text verbatim (falling back to the default if it is empty); any
 * unknown preset falls back to the default so compose always has a voice.
 */
export function resolvePersona(preset: string | undefined, customPrompt: string | undefined): string {
  if (preset === 'custom') {
    const custom = (customPrompt ?? '').trim()
    return custom || DEFAULT_FRAGMENT
  }
  const known = PERSONAS[preset as PresetId]
  return known ? known.fragment : DEFAULT_FRAGMENT
}
