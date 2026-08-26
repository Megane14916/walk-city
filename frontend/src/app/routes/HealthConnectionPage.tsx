import { useNavigate } from 'react-router-dom'
import { OnboardingLayout } from '../layouts/OnboardingLayout'
import { paths } from '../paths'
import { UserMenu } from '../../features/auth/components'
import { HealthConnectionPanel } from '../../features/health/components'

export function HealthConnectionPage() {
  const navigate = useNavigate()
  const continueToTown = () => navigate(paths.root, { replace: true })

  return (
    <OnboardingLayout>
      <HealthConnectionPanel
        account={<UserMenu />}
        onSkip={continueToTown}
        onContinue={continueToTown}
      />
    </OnboardingLayout>
  )
}
