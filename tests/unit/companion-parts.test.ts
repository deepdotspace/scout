import { describe, it, expect } from 'vitest'
import {
  partsFromSteps,
  sourcesFromToolResult,
  toolLabel,
  asChatParts,
  type StepLike,
  type ChatPart,
} from '../../src/lib/companion-parts'
import { clampRailWidth, MIN_RAIL_WIDTH } from '../../src/components/reader/useRailWidth'

describe('partsFromSteps', () => {
  it('interleaves text and tool parts in the order they occurred', () => {
    const steps: StepLike[] = [
      {
        text: 'Let me check that.',
        toolCalls: [{ toolCallId: 't1', toolName: 'look_it_up', input: { query: 'price of the thing' } }],
        toolResults: [
          {
            toolCallId: 't1',
            toolName: 'look_it_up',
            output: { answer: 'It is $99.', sources: [{ name: 'Maker', url: 'https://maker.example/p' }] },
          },
        ],
      },
      { text: 'It runs ninety-nine dollars.' },
    ]
    const parts = partsFromSteps(steps)
    expect(parts).toEqual<ChatPart[]>([
      { type: 'text', text: 'Let me check that.' },
      {
        type: 'tool',
        toolName: 'look_it_up',
        label: 'Looked up "price of the thing"',
        sources: [{ name: 'Maker', url: 'https://maker.example/p' }],
      },
      { type: 'text', text: 'It runs ninety-nine dollars.' },
    ])
  })

  it('labels read_source by the page name and keeps its single chip', () => {
    const steps: StepLike[] = [
      {
        text: '',
        toolCalls: [{ toolCallId: 'r1', toolName: 'read_source', input: { url: 'https://www.example.com/post' } }],
        toolResults: [
          { toolCallId: 'r1', toolName: 'read_source', output: { url: 'https://www.example.com/post', name: 'Example Post', text: 'body' } },
        ],
      },
    ]
    const parts = partsFromSteps(steps)
    expect(parts).toEqual<ChatPart[]>([
      {
        type: 'tool',
        toolName: 'read_source',
        label: 'Read Example Post',
        sources: [{ name: 'Example Post', url: 'https://www.example.com/post' }],
      },
    ])
  })

  it('keeps an honest tool part with no chips when the tool found nothing', () => {
    const steps: StepLike[] = [
      {
        text: 'Looking.',
        toolCalls: [{ toolCallId: 't1', toolName: 'look_it_up', input: { query: 'an obscure spec' } }],
        toolResults: [{ toolCallId: 't1', toolName: 'look_it_up', output: { answer: 'Found nothing useful for that.', sources: [] } }],
      },
    ]
    const parts = partsFromSteps(steps)
    expect(parts[1]).toEqual({
      type: 'tool',
      toolName: 'look_it_up',
      label: 'Looked up "an obscure spec"',
      sources: [],
    })
  })

  it('falls back to a host label for read_source when the input has only a url', () => {
    const label = toolLabel('read_source', { url: 'https://www.acme.io/x' }, [])
    expect(label).toBe('Read acme.io')
  })

  it('drops empty text steps but keeps the tool calls', () => {
    const steps: StepLike[] = [
      { text: '   ', toolCalls: [{ toolCallId: 'a', toolName: 'look_it_up', input: { query: 'q' } }], toolResults: [] },
    ]
    const parts = partsFromSteps(steps)
    expect(parts).toHaveLength(1)
    expect(parts[0].type).toBe('tool')
  })
})

describe('sourcesFromToolResult', () => {
  it('extracts look_it_up sources and ignores entries without a url', () => {
    const out = sourcesFromToolResult('look_it_up', {
      sources: [{ name: 'A', url: 'https://a.example' }, { name: 'no url' }],
    })
    expect(out).toEqual([{ name: 'A', url: 'https://a.example' }])
  })

  it('returns nothing for a non-object or unknown shape', () => {
    expect(sourcesFromToolResult('look_it_up', null)).toEqual([])
    expect(sourcesFromToolResult('read_source', { name: 'x' })).toEqual([])
  })
})

describe('asChatParts (persisted decode + legacy fallback)', () => {
  it('round-trips a stored parts array, keeping only valid parts', () => {
    const stored: unknown = [
      { type: 'text', text: 'hi' },
      { type: 'tool', toolName: 'look_it_up', label: 'Looked up "x"', sources: [] },
      { type: 'garbage' },
      null,
    ]
    expect(asChatParts(stored)).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'tool', toolName: 'look_it_up', label: 'Looked up "x"', sources: [] },
    ])
  })

  it('returns an empty array for a legacy row whose parts are absent or []', () => {
    expect(asChatParts(undefined)).toEqual([])
    expect(asChatParts([])).toEqual([])
  })
})

describe('clampRailWidth', () => {
  it('floors below the minimum and rounds', () => {
    expect(clampRailWidth(120)).toBe(MIN_RAIL_WIDTH)
    expect(clampRailWidth(360.4)).toBe(360)
  })

  it('caps above the maximum (no window in node, so max is the 560px bound)', () => {
    const huge = clampRailWidth(99999)
    expect(huge).toBeGreaterThanOrEqual(MIN_RAIL_WIDTH)
    expect(huge).toBe(560)
  })
})
