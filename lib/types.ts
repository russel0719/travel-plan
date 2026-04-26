export type ScheduleItemType = 'attraction' | 'restaurant' | 'hotel' | 'transport' | 'activity'
export type TransportType = 'walk' | 'public' | 'car' | 'taxi' | 'flight'
export type BudgetCategory = 'flight' | 'hotel' | 'food' | 'transport' | 'activity' | 'shopping' | 'etc'

export interface Location {
  name: string
  lat: number
  lng: number
  address?: string
}

export interface ScheduleItem {
  id: string
  type: ScheduleItemType
  title: string
  time?: string
  duration?: number
  location?: Location
  transportToNext?: TransportType
  notes?: string
  price?: number
  currency?: string
}

export interface DaySchedule {
  date: string
  items: ScheduleItem[]
}

export interface Flight {
  id: string
  direction: 'outbound' | 'inbound'
  airline: string
  flightNumber: string
  departureAirport: string
  departureDate: string
  departureTime: string
  arrivalAirport: string
  arrivalDate: string
  arrivalTime: string
  bookingRef?: string
  seat?: string
  priceKRW?: number
}

export interface Accommodation {
  id: string
  name: string
  address?: string
  checkInDate: string
  checkInTime?: string
  checkOutDate: string
  checkOutTime?: string
  bookingPlatform?: string
  bookingRef?: string
  phone?: string
  priceKRW?: number
}

export interface BudgetItem {
  id: string
  category: BudgetCategory
  label?: string
  plannedKRW: number
}

export interface Budget {
  localCurrency: string
  exchangeRate: number
  items: BudgetItem[]
}

export interface ReportPhotoMeta {
  id: string
  storagePath: string  // {userId}/{tripId}/{reportId}/{id}.jpg
  dayIndex: number     // 배치된 날짜 (0-based)
  order: number        // 날짜 내 순서
  comment: string      // 사용자 코멘트
}

export interface TravelReport {
  id: string
  title: string
  createdAt: string
  status: 'draft' | 'completed'
  photoMeta: ReportPhotoMeta[]
  userNotes: string
  aiGeneratedText: string              // 전체 총평
  aiDayTexts: Record<string, string>   // dayIndex(string) → AI 보충 텍스트
  scheduleSummary: string
}

export interface Trip {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  isInternational: boolean
  days: DaySchedule[]
  flights?: Flight[]
  accommodations?: Accommodation[]
  budget?: Budget
  reports?: TravelReport[]
  createdAt: string
  updatedAt: string
}

export const ITEM_TYPE_LABELS: Record<ScheduleItemType, string> = {
  attraction: '관광',
  restaurant: '식당',
  hotel: '숙박',
  transport: '이동',
  activity: '액티비티',
}

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  flight: '항공',
  hotel: '숙박',
  food: '식비',
  transport: '교통',
  activity: '관광/액티비티',
  shopping: '쇼핑',
  etc: '기타',
}

export const BUDGET_CATEGORY_COLORS: Record<BudgetCategory, string> = {
  flight: '#6366f1',
  hotel: '#8b5cf6',
  food: '#f59e0b',
  transport: '#3b82f6',
  activity: '#10b981',
  shopping: '#ec4899',
  etc: '#6b7280',
}

export const TRANSPORT_LABELS: Record<TransportType, string> = {
  walk: '도보',
  public: '대중교통',
  car: '차량',
  taxi: '택시',
  flight: '항공',
}

export const TRANSPORT_COLORS: Record<TransportType, string> = {
  walk: '#22c55e',
  public: '#3b82f6',
  car: '#f97316',
  taxi: '#f97316',
  flight: '#a855f7',
}

export const ITEM_TYPE_COLORS: Record<ScheduleItemType, string> = {
  attraction: '#3b82f6',
  restaurant: '#f59e0b',
  hotel: '#8b5cf6',
  transport: '#6b7280',
  activity: '#10b981',
}

export const ITEM_TYPE_TO_BUDGET: Record<ScheduleItemType, BudgetCategory> = {
  attraction: 'activity',
  restaurant: 'food',
  hotel: 'hotel',
  transport: 'transport',
  activity: 'activity',
}
