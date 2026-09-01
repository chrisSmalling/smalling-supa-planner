import { HouseholdProvider, useHousehold } from '@/contexts/HouseholdContext'
import { SetupHousehold } from '@/pages/SetupHousehold'
import { WhoAreYou } from '@/pages/WhoAreYou'
import { Planner } from '@/pages/Planner'
import { useCurrentPerson } from '@/hooks/useCurrentPerson'
import { Button } from '@/components/ui/button'

function Gate() {
  const { household, members, loading, error, refresh } = useHousehold()
  const { currentPerson, setCurrentPerson, clearCurrentPerson } = useCurrentPerson(members)

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Loading…</div>
  }
  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">Couldn't reach the server. Check your connection.</p>
        <Button onClick={() => refresh()}>Try again</Button>
      </div>
    )
  }
  if (!household) return <SetupHousehold />
  if (!currentPerson) return <WhoAreYou onPick={setCurrentPerson} />
  return <Planner currentPerson={currentPerson} onSwitchPerson={clearCurrentPerson} />
}

export default function App() {
  return (
    <HouseholdProvider>
      <Gate />
    </HouseholdProvider>
  )
}
