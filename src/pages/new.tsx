/**
 * New newsletter (route `/new`). The 6-step create stepper (DESIGN_V2.md section
 * 5, shots 11 to 16). A topic may arrive prefilled from the onboarding handoff
 * (`?topic=`). CreateFlow owns every step, all state, and the real wiring
 * (scout's-read, create, schedule, send-now); this page just frames it and the
 * back path.
 */

import { useNavigate, useSearchParams } from 'react-router-dom'
import { CreateFlow } from '../components/create'

export default function NewNewsletterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialTopic = params.get('topic') ?? ''

  return <CreateFlow mode="create" initialTopic={initialTopic} onCancel={() => navigate('/')} />
}
