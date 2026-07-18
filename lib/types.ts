export type ScheduleItemType = 'attraction' | 'restaurant' | 'hotel' | 'transport'
export type TransportType = 'walk' | 'public' | 'car' | 'taxi' | 'flight'
export type BudgetCategory = 'flight' | 'hotel' | 'food' | 'transport' | 'activity' | 'shopping' | 'etc'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type CheckType = 'checkin' | 'checkout'

export interface Location {
  name: string
  lat: number
  lng: number
  address?: string
  placeId?: string                    // Google Place ID — 지도 링크를 장소 페이지로 열기 위해 저장한다
}

export interface ScheduleItem {
  id: string
  type: ScheduleItemType
  title: string
  startTime?: string                  // "HH:MM"
  endTime?: string                    // "HH:MM" — startTime보다 이르면 익일로 본다
  location?: Location
  notes?: string
  price?: number
  currency?: string
  // 카테고리 전용 필드 — CATEGORY_EXTRA_FIELDS 매핑에 따라 폼에서 조건부로 노출된다
  mealType?: MealType                 // restaurant 전용 — 식사 유형
  reservationNeeded?: boolean         // restaurant / attraction / hotel — 예약 필요 여부
  checkType?: CheckType               // hotel 전용 — 체크인/체크아웃 구분
  fromLocation?: Location             // transport 전용 — 출발지 (location은 도착지로 사용)
  transportMode?: TransportType       // transport 전용 — 이 이동 항목 자체의 수단
  placePhotoUrl?: string               // Google Place Details — 대표 사진 URL (location 선택 시에만 채워짐)
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
  lat?: number
  lng?: number
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
}

export const ITEM_TYPE_TO_BUDGET: Record<ScheduleItemType, BudgetCategory> = {
  attraction: 'activity',
  restaurant: 'food',
  hotel: 'hotel',
  transport: 'transport',
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식/카페',
}

export const CHECK_TYPE_LABELS: Record<CheckType, string> = {
  checkin: '체크인',
  checkout: '체크아웃',
}

// 카테고리별로 ScheduleForm에서 조건부로 노출할 전용 필드 키 목록
export const CATEGORY_EXTRA_FIELDS: Record<ScheduleItemType, string[]> = {
  attraction: ['reservationNeeded'],
  restaurant: ['mealType', 'reservationNeeded'],
  hotel: ['checkType', 'reservationNeeded'],
  transport: ['fromLocation', 'transportMode'],
}
