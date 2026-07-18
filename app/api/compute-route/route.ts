import { NextRequest, NextResponse } from 'next/server'
import { TransportType } from '@/lib/types'

// Google 신규 Routes API — 기존 Directions API/Distance Matrix API를 통합한 서비스.
// 서버 전용 키(GOOGLE_ROUTES_API_KEY, NEXT_PUBLIC_ 접두사 없음)로만 호출한다.
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'

// flight은 항공편(별도 Flight 엔티티)이라 도로 경로 계산 대상이 아니다.
const TRAVEL_MODE: Partial<Record<TransportType, string>> = {
  walk: 'WALK',
  public: 'TRANSIT',
  car: 'DRIVE',
  taxi: 'DRIVE',
}

interface LatLng {
  lat: number
  lng: number
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_ROUTES_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { origin, destination, mode, trafficAware = true } = await req.json() as {
    origin: LatLng
    destination: LatLng
    mode: TransportType
    trafficAware?: boolean
  }

  const travelMode = TRAVEL_MODE[mode]
  if (!travelMode) {
    return NextResponse.json({ error: `경로 계산을 지원하지 않는 이동수단: ${mode}` }, { status: 400 })
  }

  const callRoutes = async (googleMode: string) => {
    const res = await fetch(ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: googleMode,
        // TRAFFIC_UNAWARE는 더 저렴하고 결과가 안정적이라 캐시하기 좋다 — 인쇄용 경로가 쓴다.
        ...(googleMode === 'DRIVE'
          ? { routingPreference: trafficAware ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE' }
          : {}),
      }),
    })
    if (!res.ok) return { ok: false as const, status: res.status, text: await res.text() }
    const data = await res.json()
    return { ok: true as const, route: data.routes?.[0] }
  }

  try {
    let result = await callRoutes(travelMode)
    let approximate = false

    // 대중교통 경로가 없으면 도로 경로로 대체한다.
    // Google은 일부 국가(일본 등)에서 대중교통 데이터를 API로 제공하지 않아, 도쿄역→신주쿠역
    // 같은 구간도 TRANSIT은 경로 0개로 돌아온다(실측). 그대로 두면 지도에 직선이 그어져
    // "경로가 끊긴 것처럼" 보이므로, 도로를 따라가는 대략적인 선이라도 그린다.
    // approximate 플래그로 호출부가 점선 등으로 구분할 수 있게 한다.
    if (travelMode === 'TRANSIT' && result.ok && !result.route) {
      const fallback = await callRoutes('DRIVE')
      if (fallback.ok && fallback.route) {
        result = fallback
        approximate = true
      }
    }

    if (!result.ok) {
      return NextResponse.json({ error: `Routes API 오류: ${result.text}` }, { status: result.status })
    }
    if (!result.route) {
      return NextResponse.json({ error: '경로를 찾을 수 없습니다.' }, { status: 404 })
    }

    const route = result.route
    return NextResponse.json({
      durationSeconds: route.duration ? parseInt(route.duration, 10) : null,
      distanceMeters: route.distanceMeters ?? null,
      encodedPolyline: route.polyline?.encodedPolyline ?? null,
      approximate,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
