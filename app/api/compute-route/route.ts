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

  const { origin, destination, mode } = await req.json() as {
    origin: LatLng
    destination: LatLng
    mode: TransportType
  }

  const travelMode = TRAVEL_MODE[mode]
  if (!travelMode) {
    return NextResponse.json({ error: `경로 계산을 지원하지 않는 이동수단: ${mode}` }, { status: 400 })
  }

  try {
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
        travelMode,
        ...(travelMode === 'DRIVE' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `Routes API 오류: ${errText}` }, { status: res.status })
    }

    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) {
      return NextResponse.json({ error: '경로를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({
      durationSeconds: route.duration ? parseInt(route.duration, 10) : null,
      distanceMeters: route.distanceMeters ?? null,
      encodedPolyline: route.polyline?.encodedPolyline ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
