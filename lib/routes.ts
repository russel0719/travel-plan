import { TransportType } from './types'

export interface RouteInfo {
  durationSeconds: number
  distanceMeters: number
  encodedPolyline: string | null
}

interface LatLng {
  lat: number
  lng: number
}

// /api/compute-route 서버 프록시(Google Routes API)를 호출한다.
// 서버 키 미설정, 네트워크 실패, 지원 안 하는 이동수단 등 어떤 이유로든 실패하면
// null을 반환한다 — 호출부는 "정보 없음"으로 조용히 처리하면 된다(throw 안 함).
export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TransportType
): Promise<RouteInfo | null> {
  try {
    const res = await fetch('/api/compute-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, mode }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.durationSeconds == null || data.distanceMeters == null) return null
    return data as RouteInfo
  } catch {
    return null
  }
}
