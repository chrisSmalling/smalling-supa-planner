import * as React from 'react'
import type { Profile } from '@/lib/types'

const STORAGE_KEY = 'superplan:current-person-id'

/**
 * Which household member "is" this device — purely for attribution (who
 * created an item, who checked off a chore), not an access boundary. There's
 * no login, so this is just a per-device localStorage preference.
 */
export function useCurrentPerson(members: Profile[]) {
  const [currentPersonId, setCurrentPersonId] = React.useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  )

  const currentPerson = members.find((m) => m.id === currentPersonId) ?? null

  function setCurrentPerson(person: Profile) {
    localStorage.setItem(STORAGE_KEY, person.id)
    setCurrentPersonId(person.id)
  }

  function clearCurrentPerson() {
    localStorage.removeItem(STORAGE_KEY)
    setCurrentPersonId(null)
  }

  return { currentPerson, setCurrentPerson, clearCurrentPerson }
}
