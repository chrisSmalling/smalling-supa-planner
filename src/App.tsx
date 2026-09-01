import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { SignIn } from '@/pages/SignIn'
import { Onboarding } from '@/pages/Onboarding'
import { Planner } from '@/pages/Planner'

function Gate() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Loading…</div>
  }
  if (!session) return <SignIn />
  if (!profile) return <Onboarding />
  return <Planner />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
