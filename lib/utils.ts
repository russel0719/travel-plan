import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Location } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 저장된 장소를 Google 지도에서 여는 URL. 장소 검색으로 선택했으면 좌표가 있으므로 좌표로 열어
// 정확한 지점을 가리키고, 사용자가 직접 타이핑해 좌표가 없으면(선택 안 하면 0으로 채워진다)
// 이름으로 검색한다. 이름조차 없으면 null — 호출부는 링크를 렌더링하지 않는다.
export function googleMapsUrl(location: Location): string | null {
  const hasCoords = location.lat !== 0 || location.lng !== 0
  const query = hasCoords ? `${location.lat},${location.lng}` : location.name.trim()
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
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

