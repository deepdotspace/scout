/**
 * Edit newsletter (route `/n/:id/edit`). Reuses the create stepper's middle four
 * steps (Scope, Voice, Rhythm, Boundaries) prefilled from the record, saving in
 * place (DESIGN_V2.md, REDESIGN_PLAN V3). Loading, not-found, and error states
 * cover the fetch so the user never lands on a blank page.
 *
 * `?demo=1` edits a visual fixture so the flow screenshots with no auth or DB.
 */

import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { CreateFlow } from '../../../components/create'
import { InlineStatus } from '../../../components/scout'
import { ScoutMark } from '../../../components/scout/Logo'
import { DEMO_NEWSLETTERS, isDemo } from '../../../lib/demo'
import type { Newsletter } from '../../../lib/types'

export default function EditNewsletterPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const demo = isDemo()

  const { records, status } = useQuery<Newsletter>('newsletters')
  const record = demo
    ? DEMO_NEWSLETTERS.find((r) => r.recordId === id) ?? DEMO_NEWSLETTERS[0]
    : records.find((r) => r.recordId === id)

  const back = () => navigate(id ? `/n/${id}` : '/')

  if (demo && record) {
    return <CreateFlow mode="edit" initial={record.data} recordId={record.recordId} onCancel={back} />
  }

  if (status === 'loading' && !record) {
    return (
      <div className="flex h-full items-center justify-center">
        <ScoutMark size={24} className="animate-pulse opacity-40" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto w-full max-w-[660px] px-5 py-10 md:px-10">
        <InlineStatus tone="danger">Could not load this newsletter. Check your connection and reload.</InlineStatus>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="mx-auto w-full max-w-[660px] px-5 py-10 md:px-10">
        <InlineStatus tone="warning">
          That newsletter does not exist, or it was deleted. Head back Home to pick another.
        </InlineStatus>
      </div>
    )
  }

  return <CreateFlow mode="edit" initial={record.data} recordId={record.recordId} onCancel={back} />
}
