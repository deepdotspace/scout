/**
 * Scout primitives: the design-system surface built from docs/design/DESIGN_V2.md
 * (the press-wire paper world). One import for every shared building block.
 *
 * @example
 * import { Button, Card, EyebrowLabel, StatusDot, useScoutToast } from '../components/scout'
 */

export { Button, type ButtonProps } from './Button'
export { Card, type CardProps } from './Card'
export { Input, Textarea, Label, Field } from './Field'
export { EyebrowLabel } from './Eyebrow'
export { Pill, type PillProps } from './Pill'
export { SourceChip } from './SourceChip'
export { StatusDot } from './StatusDot'
export { Composer, type ComposerProps } from './Composer'
export { ScoutToastProvider, useScoutToast } from './ScoutToast'
export { MetaChip } from './MetaChip'
export { EmptyState } from './EmptyState'
export { TabItem } from './RailItem'
export { Sidebar } from './Sidebar'
export { AppShell } from './AppShell'
export { ConfigHealthDot, InlineStatus, type Health } from './Status'
export { useConfigHealth, rollUp } from './useConfigHealth'
export { ScoutMark, ScoutWordmark } from './Logo'
export { StubPage } from './StubPage'
export { EASE, PRESS, useReducedMotion } from './motion'
