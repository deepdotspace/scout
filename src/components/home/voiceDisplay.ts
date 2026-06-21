/**
 * The design's voice display labels for the home desk + featured byline
 * (DESIGN_V2.md / REDESIGN_PLAN voice mapping). These are the wire-machine
 * labels shown on the desk ("SHARP ANALYST", "EXECUTIVE BRIEF", ...), distinct
 * from the picker's persona labels in personas.ts (owned by the create wave).
 * Keyed on the stable persona ids so existing newsletters keep their voice.
 */

const VOICE_DISPLAY: Record<string, string> = {
  analyst: 'Sharp Analyst',
  operator: 'Executive Brief',
  scholar: 'Precise Academic',
  companion: 'Warm Companion',
  storyteller: 'Storyteller',
  custom: 'Your own voice',
}

/** The desk display label for a stored voicePreset (unknown falls to a voice). */
export function voiceDisplay(preset: string | undefined): string {
  return VOICE_DISPLAY[preset ?? ''] ?? 'Your own voice'
}
