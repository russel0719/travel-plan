import { supabase } from './supabase'
import { Trip } from './types'
import {
  assembleTrips,
  TripRow,
  ScheduleItemRow,
  FlightRow,
  AccommodationRow,
  BudgetRow,
  BudgetItemRow,
  ReportRow,
  ReportDayTextRow,
  ReportPhotoRow,
} from './tripAssembly'

const LOCAL_KEY = 'travel-plan-trips'

export async function loadTrips(userId: string): Promise<Trip[]> {
  const { data: tripRows, error: tripsError } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, is_international, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (tripsError) {
    console.error('loadTrips error:', tripsError.message)
    return []
  }
  if (!tripRows || tripRows.length === 0) return []

  const tripIds = tripRows.map((t) => t.id)

  const [
    { data: scheduleItems, error: scheduleItemsError },
    { data: flights, error: flightsError },
    { data: accommodations, error: accommodationsError },
    { data: budgets, error: budgetsError },
    { data: budgetItems, error: budgetItemsError },
    { data: reports, error: reportsError },
    { data: reportDayTexts, error: reportDayTextsError },
    { data: reportPhotos, error: reportPhotosError },
  ] = await Promise.all([
    supabase.from('schedule_items').select('*').in('trip_id', tripIds),
    supabase.from('flights').select('*').in('trip_id', tripIds),
    supabase.from('accommodations').select('*').in('trip_id', tripIds),
    supabase.from('budgets').select('*').in('trip_id', tripIds),
    supabase.from('budget_items').select('*').in('trip_id', tripIds),
    supabase.from('reports').select('*').in('trip_id', tripIds),
    supabase.from('report_day_texts').select('*').in('trip_id', tripIds),
    supabase.from('report_photos').select('*').in('trip_id', tripIds),
  ])

  const firstError =
    scheduleItemsError || flightsError || accommodationsError || budgetsError ||
    budgetItemsError || reportsError || reportDayTextsError || reportPhotosError
  if (firstError) {
    console.error('loadTrips (child tables) error:', firstError.message)
    return []
  }

  return assembleTrips(tripRows as TripRow[], {
    scheduleItems: (scheduleItems ?? []) as ScheduleItemRow[],
    flights: (flights ?? []) as FlightRow[],
    accommodations: (accommodations ?? []) as AccommodationRow[],
    budgets: (budgets ?? []) as BudgetRow[],
    budgetItems: (budgetItems ?? []) as BudgetItemRow[],
    reports: (reports ?? []) as ReportRow[],
    reportDayTexts: (reportDayTexts ?? []) as ReportDayTextRow[],
    reportPhotos: (reportPhotos ?? []) as ReportPhotoRow[],
  })
}

export async function upsertTrip(trip: Trip, _userId: string): Promise<void> {
  const { error } = await supabase.rpc('upsert_trip', { p_trip: trip })
  if (error) console.error('upsertTrip error:', error.code, error.message, error.details, error.hint)
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
