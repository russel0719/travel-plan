import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Location } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 저장된 장소를 Google 지도에서 여는 URL.
//
// 좌표로 열면 안 된다 — 지도가 "35°39'31.0"N 139°44'43.4"E, 리뷰 없음"이라는 빈 좌표 핀만
// 보여줘서 영업시간·전화·사진 같은 장소 정보를 전혀 볼 수 없다(실측 확인).
// place_id를 함께 넘기면 Google이 그걸 우선해 정확한 장소 페이지를 연다(query 텍스트가 다른
// 장소를 가리켜도 place_id가 이긴다 — 이것도 실측으로 확인).
// place_id가 없는 예전 데이터는 이름으로 검색한다 — 동명이인 위험은 있지만 좌표보다 훨씬 낫고,
// 실제로도 장소 카드가 뜬다. 이름조차 없으면(지도에서 빈 공간만 찍은 경우) 그때만 좌표로 떨어진다.
export function googleMapsUrl(location: Location): string | null {
  const name = location.name.trim()
  const base = 'https://www.google.com/maps/search/?api=1&query='

  if (name) {
    const url = `${base}${encodeURIComponent(name)}`
    return location.placeId ? `${url}&query_place_id=${encodeURIComponent(location.placeId)}` : url
  }
  if (location.lat !== 0 || location.lng !== 0) {
    return `${base}${encodeURIComponent(`${location.lat},${location.lng}`)}`
  }
  return null
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

export function getDaysBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

export function getDayLabel(index: number): string {
  return `${index + 1}일차`
}

const MINUTES_PER_DAY = 24 * 60

// "HH:MM" → 자정 기준 분. 형식이 어긋나면 null.
export function parseTimeToMinutes(hhmm: string | undefined): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// 분 → "HH:MM". 자정을 넘거나 음수면 하루 안으로 감는다(23:30 + 60분 = 00:30).
export function minutesToTime(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// 두 시각 사이의 분. 종료가 시작보다 이르면 익일로 본다 — 야간버스나 심야 일정이 실제로 있다.
export function timeRangeMinutes(start: string | undefined, end: string | undefined): number | null {
  const s = parseTimeToMinutes(start)
  const e = parseTimeToMinutes(end)
  if (s == null || e == null) return null
  return e >= s ? e - s : e + MINUTES_PER_DAY - s
}

// 카드와 인쇄가 이 함수를 공유한다 — 각자 문자열을 만들면 표시가 서로 어긋난다.
export function formatTimeRange(start: string | undefined, end: string | undefined): string | null {
  if (start && end) return `${start} ~ ${end}`
  return start || end || null
}

export function formatDurationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}시간 ${m}분`
  if (h) return `${h}시간`
  return `${m}분`
}

