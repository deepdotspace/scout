/**
 * TabItem: a mobile bottom-tab cell. The active state lifts to the accent.
 * (The desktop sidebar builds its own rows in Sidebar.tsx; this is the mobile
 * chrome only.)
 */

import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

export function TabItem({
  to,
  icon,
  label,
  end,
}: {
  to: string
  icon: ReactNode
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'sct-tab flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
          '[&_svg]:size-5',
          isActive && 'sct-tab-active',
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}
