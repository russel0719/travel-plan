import { TransportType, Location, ScheduleItem } from './types'

export interface RouteInfo {
  durationSeconds: number
  distanceMeters: number
  encodedPolyline: string | null
  /** 요청한 이동수단의 실제 경로가 아니라 도로 경로로 대체된 결과 (예: 일본의 대중교통) */
  approximate?: boolean
}

interface LatLng {
  lat: number
  lng: number
}

// 장소와 장소 사이는 걸어서 이동하는 것으로 본다.
//
// 예전에는 일정마다 "다음 장소 이동수단"을 따로 입력받아 그 값이 있을 때만 경로를 조회했는데,
// 실제로는 절반 이상이 비어 있어서 그 구간이 지도에 직선으로 그어졌다 — "경로가 잘 그려지다
// 갑자기 끊기는" 것처럼 보이던 원인이다. 이동수단이 의미를 갖는 건 '이동' 카테고리 안에서뿐이라
// 그 입력을 없애고, 장소 사이는 도보로 고정한다.
export const BETWEEN_STOPS_MODE: TransportType = 'walk'

export interface RouteSegment {
  from: Location
  to: Location
  mode: TransportType
}

function hasCoords(loc: Location | undefined): loc is Location {
  return !!loc && (loc.lat !== 0 || loc.lng !== 0)
}

// 같은 지점인지 — 이동 항목의 도착지와 그 다음 일정의 장소가 같은 곳인 경우가 흔하다
// (예: "…→ C역 이동" 다음에 "C역 관광"). 그 구간은 그릴 것이 없다.
function samePlace(a: Location, b: Location): boolean {
  return a.lat.toFixed(5) === b.lat.toFixed(5) && a.lng.toFixed(5) === b.lng.toFixed(5)
}

/**
 * 하루 동선을 구간 목록으로 편다.
 *
 * '이동' 카테고리 항목은 fromLocation(출발)과 location(도착) **두 지점**을 만들고, 그 사이
 * 구간만 항목의 transportMode를 쓴다. 나머지 장소 사이는 전부 도보다.
 *
 *   관광 A → [이동: B→C(전철)] → 관광 C
 *     A→B 도보 / B→C 전철 / C→C는 같은 장소라 생략
 */
export function daySegments(items: ScheduleItem[]): RouteSegment[] {
  const segments: RouteSegment[] = []
  let prev: Location | null = null

  for (const item of items) {
    const isTransport = item.type === 'transport' && hasCoords(item.fromLocation) && hasCoords(item.location)

    if (isTransport) {
      const start = item.fromLocation!
      const end = item.location!
      if (prev) segments.push({ from: prev, to: start, mode: BETWEEN_STOPS_MODE })
      segments.push({ from: start, to: end, mode: item.transportMode ?? BETWEEN_STOPS_MODE })
      prev = end
    } else if (hasCoords(item.location)) {
      if (prev) segments.push({ from: prev, to: item.location, mode: BETWEEN_STOPS_MODE })
      prev = item.location
    }
  }

  return segments.filter((s) => !samePlace(s.from, s.to))
}

// /api/compute-route 서버 프록시(Google Routes API)를 호출한다.
// 서버 키 미설정, 네트워크 실패, 지원 안 하는 이동수단 등 어떤 이유로든 실패하면
// null을 반환한다 — 호출부는 "정보 없음"으로 조용히 처리하면 된다(throw 안 함).
export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TransportType,
  // 인쇄물에는 실시간 교통이 무의미하고(종이는 이미 과거다) 더 저렴하므로 false를 넘긴다.
  // 앱 안의 지도는 기존대로 교통 반영을 유지한다.
  trafficAware = true
): Promise<RouteInfo | null> {
  try {
    const res = await fetch('/api/compute-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, mode, trafficAware }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.durationSeconds == null || data.distanceMeters == null) return null
    return data as RouteInfo
  } catch {
    return null
  }
}
