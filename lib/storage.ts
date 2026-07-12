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

export interface LoadTripsResult {
  trips: Trip[]
  error: string | null
}

export type MutationResult = { ok: true } | { ok: false; error: string }

export async function loadTrips(userId: string): Promise<LoadTripsResult> {
  const { data: tripRows, error: tripsError } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, is_international, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (tripsError) {
    console.error('loadTrips error:', tripsError.message)
    return { trips: [], error: `여행 목록을 불러오지 못했습니다: ${tripsError.message}` }
  }
  if (!tripRows || tripRows.length === 0) return { trips: [], error: null }

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

  // 자식 테이블 하나가 실패해도 여행 전체를 숨기지 않는다 — 실패한 테이블만 빈 값으로
  // 처리해 나머지 정보는 정상 표시하고, 어떤 테이블이 실패했는지만 에러로 표면화한다.
  // (예전에는 자식 1개라도 실패하면 return [] 라, 테이블 하나가 사라진 게 "여행 전체 소실"처럼 보였다.)
  const childErrors = (
    [
      ['일정', scheduleItemsError],
      ['항공', flightsError],
      ['숙박', accommodationsError],
      ['예산', budgetsError],
      ['예산 항목', budgetItemsError],
      ['후기', reportsError],
      ['후기 텍스트', reportDayTextsError],
      ['후기 사진', reportPhotosError],
    ] as const
  )
    .filter(([, e]) => e)
    .map(([name, e]) => ({ name, message: e!.message }))

  if (childErrors.length) {
    console.error('loadTrips (child tables) error:', childErrors.map((c) => `${c.name}: ${c.message}`).join(' | '))
  }

  return {
    trips: assembleTrips(tripRows as TripRow[], {
      scheduleItems: (scheduleItems ?? []) as ScheduleItemRow[],
      flights: (flights ?? []) as FlightRow[],
      accommodations: (accommodations ?? []) as AccommodationRow[],
      budgets: (budgets ?? []) as BudgetRow[],
      budgetItems: (budgetItems ?? []) as BudgetItemRow[],
      reports: (reports ?? []) as ReportRow[],
      reportDayTexts: (reportDayTexts ?? []) as ReportDayTextRow[],
      reportPhotos: (reportPhotos ?? []) as ReportPhotoRow[],
    }),
    error: childErrors.length
      ? `일부 데이터를 불러오지 못했습니다 (${childErrors.map((c) => c.name).join(', ')})`
      : null,
  }
}

export async function upsertTrip(trip: Trip, _userId: string): Promise<MutationResult> {
  const { error } = await supabase.rpc('upsert_trip', { p_trip: trip })
  if (error) {
    console.error('upsertTrip error:', error.code, error.message, error.details, error.hint)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function removeTrip(tripId: string): Promise<MutationResult> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId)
  if (error) {
    console.error('removeTrip error:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
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
