import {
  Trip,
  DaySchedule,
  ScheduleItem,
  ScheduleItemType,
  TransportType,
  MealType,
  CheckType,
  Location,
  Flight,
  Accommodation,
  Budget,
  BudgetCategory,
  BudgetItem,
  TravelReport,
  ReportPhotoMeta,
} from './types'
import { getDaysBetween } from './utils'

// Supabase(PostgREST)는 numeric 컬럼을 정밀도 손실 방지를 위해 문자열로 내려줄 수 있다 — 항상 명시적으로 변환한다.
function toNumber(v: number | string | null): number {
  return Number(v)
}
function toOptionalNumber(v: number | string | null): number | undefined {
  return v == null ? undefined : Number(v)
}

export interface TripRow {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  is_international: boolean
  created_at: string
  updated_at: string
}

export interface ScheduleItemRow {
  id: string
  trip_id: string
  day_date: string
  position: number
  type: string
  title: string
  time: string | null
  duration: number | null
  location_name: string | null
  location_lat: number | string | null
  location_lng: number | string | null
  location_address: string | null
  from_location_name: string | null
  from_location_lat: number | string | null
  from_location_lng: number | string | null
  from_location_address: string | null
  transport_to_next: string | null
  notes: string | null
  price: number | string | null
  currency: string | null
  meal_type: string | null
  reservation_needed: boolean | null
  check_type: string | null
  transport_mode: string | null
}

export interface FlightRow {
  id: string
  trip_id: string
  direction: string
  airline: string
  flight_number: string
  departure_airport: string
  departure_date: string
  departure_time: string
  arrival_airport: string
  arrival_date: string
  arrival_time: string
  booking_ref: string | null
  seat: string | null
  price_krw: number | string | null
}

export interface AccommodationRow {
  id: string
  trip_id: string
  name: string
  address: string | null
  check_in_date: string
  check_in_time: string | null
  check_out_date: string
  check_out_time: string | null
  booking_platform: string | null
  booking_ref: string | null
  phone: string | null
  price_krw: number | string | null
}

export interface BudgetRow {
  trip_id: string
  local_currency: string
  exchange_rate: number | string
}

export interface BudgetItemRow {
  id: string
  trip_id: string
  category: string
  label: string | null
  planned_krw: number | string
}

export interface ReportRow {
  id: string
  trip_id: string
  title: string
  created_at: string
  status: string
  user_notes: string
  ai_generated_text: string
  schedule_summary: string
}

export interface ReportDayTextRow {
  report_id: string
  trip_id: string
  day_index: number
  text: string
}

export interface ReportPhotoRow {
  id: string
  report_id: string
  trip_id: string
  storage_path: string
  day_index: number
  position: number
  comment: string
}

export interface TripChildRows {
  scheduleItems: ScheduleItemRow[]
  flights: FlightRow[]
  accommodations: AccommodationRow[]
  budgets: BudgetRow[]
  budgetItems: BudgetItemRow[]
  reports: ReportRow[]
  reportDayTexts: ReportDayTextRow[]
  reportPhotos: ReportPhotoRow[]
}

function groupBy<T, K>(rows: T[], keyFn: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return map
}

function toLocation(
  name: string | null,
  lat: number | string | null,
  lng: number | string | null,
  address: string | null
): Location | undefined {
  if (name == null) return undefined
  return { name, lat: toNumber(lat), lng: toNumber(lng), address: address ?? undefined }
}

function toScheduleItem(row: ScheduleItemRow): ScheduleItem {
  return {
    id: row.id,
    type: row.type as ScheduleItemType,
    title: row.title,
    time: row.time ?? undefined,
    duration: row.duration ?? undefined,
    location: toLocation(row.location_name, row.location_lat, row.location_lng, row.location_address),
    transportToNext: (row.transport_to_next as TransportType | null) ?? undefined,
    notes: row.notes ?? undefined,
    price: toOptionalNumber(row.price),
    currency: row.currency ?? undefined,
    mealType: (row.meal_type as MealType | null) ?? undefined,
    reservationNeeded: row.reservation_needed ?? undefined,
    checkType: (row.check_type as CheckType | null) ?? undefined,
    fromLocation: toLocation(row.from_location_name, row.from_location_lat, row.from_location_lng, row.from_location_address),
    transportMode: (row.transport_mode as TransportType | null) ?? undefined,
  }
}

// schedule_items를 day_date로 그룹핑만 하면 아이템이 하나도 없는 날짜가 사라진다.
// 반드시 start~end 날짜 범위를 먼저 만들고 각 날짜에 아이템을 붙인다.
// (트립 기간을 생성 후 수정하는 UI가 없어 "days는 항상 start~end와 정확히 일치한다"는 불변식에 의존함)
function assembleDays(tripRow: TripRow, items: ScheduleItemRow[]): DaySchedule[] {
  const dates = getDaysBetween(tripRow.start_date, tripRow.end_date)
  const itemsByDate = groupBy(items, (i) => i.day_date)
  return dates.map((date) => ({
    date,
    items: (itemsByDate.get(date) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toScheduleItem),
  }))
}

function toFlight(row: FlightRow): Flight {
  return {
    id: row.id,
    direction: row.direction as Flight['direction'],
    airline: row.airline,
    flightNumber: row.flight_number,
    departureAirport: row.departure_airport,
    departureDate: row.departure_date,
    departureTime: row.departure_time,
    arrivalAirport: row.arrival_airport,
    arrivalDate: row.arrival_date,
    arrivalTime: row.arrival_time,
    bookingRef: row.booking_ref ?? undefined,
    seat: row.seat ?? undefined,
    priceKRW: toOptionalNumber(row.price_krw),
  }
}

function toAccommodation(row: AccommodationRow): Accommodation {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    checkInDate: row.check_in_date,
    checkInTime: row.check_in_time ?? undefined,
    checkOutDate: row.check_out_date,
    checkOutTime: row.check_out_time ?? undefined,
    bookingPlatform: row.booking_platform ?? undefined,
    bookingRef: row.booking_ref ?? undefined,
    phone: row.phone ?? undefined,
    priceKRW: toOptionalNumber(row.price_krw),
  }
}

function toBudgetItem(row: BudgetItemRow): BudgetItem {
  return {
    id: row.id,
    category: row.category as BudgetCategory,
    label: row.label ?? undefined,
    plannedKRW: toNumber(row.planned_krw),
  }
}

function assembleBudget(budgetRow: BudgetRow | undefined, items: BudgetItemRow[]): Budget | undefined {
  if (!budgetRow) return undefined
  return {
    localCurrency: budgetRow.local_currency,
    exchangeRate: toNumber(budgetRow.exchange_rate),
    items: items.map(toBudgetItem),
  }
}

function assembleReports(
  reportRows: ReportRow[],
  dayTextsByReport: Map<string, ReportDayTextRow[]>,
  photosByReport: Map<string, ReportPhotoRow[]>
): TravelReport[] | undefined {
  if (reportRows.length === 0) return undefined
  return reportRows.map((r): TravelReport => {
    const photoMeta: ReportPhotoMeta[] = (photosByReport.get(r.id) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.id,
        storagePath: p.storage_path,
        dayIndex: p.day_index,
        order: p.position,
        comment: p.comment,
      }))

    const aiDayTexts: Record<string, string> = {}
    for (const d of dayTextsByReport.get(r.id) ?? []) {
      aiDayTexts[String(d.day_index)] = d.text
    }

    return {
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      status: r.status as TravelReport['status'],
      photoMeta,
      userNotes: r.user_notes,
      aiGeneratedText: r.ai_generated_text,
      aiDayTexts,
      scheduleSummary: r.schedule_summary,
    }
  })
}

// 정규화된 여러 테이블의 row 배열을 받아 기존 Trip[] 형태로 재조립하는 순수 함수.
export function assembleTrips(tripRows: TripRow[], child: TripChildRows): Trip[] {
  const scheduleItemsByTrip = groupBy(child.scheduleItems, (r) => r.trip_id)
  const flightsByTrip = groupBy(child.flights, (r) => r.trip_id)
  const accommodationsByTrip = groupBy(child.accommodations, (r) => r.trip_id)
  const budgetByTrip = new Map(child.budgets.map((b) => [b.trip_id, b]))
  const budgetItemsByTrip = groupBy(child.budgetItems, (r) => r.trip_id)
  const reportsByTrip = groupBy(child.reports, (r) => r.trip_id)
  const dayTextsByReport = groupBy(child.reportDayTexts, (r) => r.report_id)
  const photosByReport = groupBy(child.reportPhotos, (r) => r.report_id)

  return tripRows.map((t): Trip => ({
    id: t.id,
    title: t.title,
    destination: t.destination,
    startDate: t.start_date,
    endDate: t.end_date,
    isInternational: t.is_international,
    days: assembleDays(t, scheduleItemsByTrip.get(t.id) ?? []),
    flights: (flightsByTrip.get(t.id) ?? []).map(toFlight),
    accommodations: (accommodationsByTrip.get(t.id) ?? []).map(toAccommodation),
    budget: assembleBudget(budgetByTrip.get(t.id), budgetItemsByTrip.get(t.id) ?? []),
    reports: assembleReports(reportsByTrip.get(t.id) ?? [], dayTextsByReport, photosByReport),
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }))
}
