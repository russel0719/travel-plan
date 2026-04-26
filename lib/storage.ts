import { Trip } from './types'

const STORAGE_KEY = 'travel-plan-trips'

export function loadTrips(): Trip[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveTrips(trips: Trip[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips))
}
