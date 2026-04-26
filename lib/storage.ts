import { supabase } from './supabase'
import { Trip } from './types'

const LOCAL_KEY = 'travel-plan-trips'

export async function loadTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('data')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('loadTrips error:', error.message)
    return []
  }

  return (data ?? []).map((row: { data: Trip }) => row.data as Trip)
}

export async function upsertTrip(trip: Trip, userId: string): Promise<void> {
  const { error } = await supabase.from('trips').upsert({
    id: trip.id,
    user_id: userId,
    data: trip,
    created_at: trip.createdAt,
    updated_at: trip.updatedAt,
  })

  if (error) console.error('upsertTrip error:', error.message)
}

export async function removeTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId)
  if (error) console.error('removeTrip error:', error.message)
}

// localStorage 마이그레이션용 유틸
export function getLocalTrips(): Trip[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as Trip[]) : []
  } catch {
    return []
  }
}

export function clearLocalTrips(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LOCAL_KEY)
}
