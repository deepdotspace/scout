/**
 * SearchField: the elevated search bar for the library Search view (DESIGN_V2.md
 * section 5, shots 06 / 06b). A --surface field with a soft two-layer shadow, a
 * leading search glyph, an autofocused input, and a live result count in mono on
 * the right. Borderless and editorial, not a chrome input.
 */

import { Search } from 'lucide-react'

export function SearchField({
  value,
  onChange,
  count,
}: {
  value: string
  onChange: (next: string) => void
  /** The mono count shown on the right once there is a query, e.g. "3 results". */
  count?: string
}) {
  return (
    <div
      className="flex items-center gap-[11px] rounded-[13px] px-[18px]"
      style={{
        height: 50,
        background: 'var(--surface)',
        boxShadow: '0 1px 2px rgba(40,30,15,.05), 0 10px 30px -22px rgba(40,30,15,.3)',
      }}
    >
      <Search className="size-[18px] shrink-0" style={{ color: 'var(--ink3)' }} strokeWidth={2} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search every dispatch Scout has filed..."
        aria-label="Search dispatches"
        autoFocus
        className="min-w-0 flex-1 border-none bg-transparent text-[16px] outline-none"
        style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
      />
      {count && (
        <span className="font-mono text-[10.5px] shrink-0" style={{ color: 'var(--ink3)' }}>
          {count}
        </span>
      )}
    </div>
  )
}
