'use client'

import { useMemo } from 'react'
import { DaySchedule, ITEM_TYPE_COLORS, TRANSPORT_COLORS } from '@/lib/types'
import { fetchRoute, daySegments, BETWEEN_STOPS_MODE } from '@/lib/routes'
import MapMock from './MapMock'
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps'
import { useEffect } from 'react'

// 구간마다 이동수단이 다르지 않으므로 동선은 한 색으로 그린다
const ROUTE_COLOR = '#3b82f6'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

interface RouteLayerProps {
  day: DaySchedule
}

function RouteLayer({ day }: RouteLayerProps) {
  const map = useMap()

  // 마커는 좌표가 있는 일정 자체에 찍고, 선은 daySegments가 만든 구간을 따라 그린다
  const points = useMemo(
    () => day.items.filter((i) => i.location && i.location.lat !== 0),
    [day]
  )
  const segments = useMemo(() => daySegments(day.items), [day])

  useEffect(() => {
    if (!map || segments.length === 0) return

    const g = (window as unknown as { google: typeof google }).google.maps
    const lines: google.maps.Polyline[] = []
    let cancelled = false

    const draw = async () => {
      for (const seg of segments) {
        const { from, to, mode } = seg
        // 도보 구간은 한 색으로, '이동' 항목 구간은 그 수단의 색으로 구분한다
        const color = mode === BETWEEN_STOPS_MODE ? ROUTE_COLOR : TRANSPORT_COLORS[mode]

        // 경로를 못 가져오면(항공, 서버 키 미설정 등) 직선으로 폴백한다.
        let path: google.maps.LatLngLiteral[] = [
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
        ]
        let approximate = false

        // 항공은 도로 경로가 없다 — 조회하지 않고 직선(점선)으로 둔다
        if (mode !== 'flight') {
          const route = await fetchRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }, mode)
          if (route?.encodedPolyline) {
            path = g.geometry.encoding
              .decodePath(route.encodedPolyline)
              .map((p) => ({ lat: p.lat(), lng: p.lng() }))
            approximate = !!route.approximate
          }
        }

        // 실제 경로가 아닌 구간(항공, 길을 못 찾음, 대중교통을 도로로 대체)은 점선으로 알린다
        const isDashed = mode === 'flight' || approximate || path.length === 2

        if (cancelled) return

        const line = new g.Polyline({
          path,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: isDashed ? 0 : 0.8,
          strokeWeight: 3,
          icons: isDashed
            ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, scale: 3, strokeColor: color }, offset: '0', repeat: '10px' }]
            : [],
          map,
        })
        lines.push(line)
      }
    }

    draw()

    return () => {
      cancelled = true
      lines.forEach((l) => l.setMap(null))
    }
  }, [map, segments])

  return (
    <>
      {points.map((item, idx) => (
        <AdvancedMarker
          key={item.id}
          position={{ lat: item.location!.lat, lng: item.location!.lng }}
          title={item.title}
        >
          <Pin
            background={ITEM_TYPE_COLORS[item.type]}
            borderColor="#fff"
            glyphColor="#fff"
            glyph={String(idx + 1)}
          />
        </AdvancedMarker>
      ))}
    </>
  )
}

interface TripMapProps {
  day: DaySchedule
}

export default function TripMap({ day }: TripMapProps) {
  if (!API_KEY) return <MapMock />

  const hasLocations = day.items.some((i) => i.location && i.location.lat !== 0)
  const center = hasLocations
    ? { lat: day.items.find((i) => i.location?.lat)!.location!.lat, lng: day.items.find((i) => i.location?.lat)!.location!.lng }
    : { lat: 35.6762, lng: 139.6503 }

  return (
    <Map
      mapId="travel-plan-map"
      defaultCenter={center}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI={false}
      className="h-full w-full rounded-lg"
    >
      <RouteLayer day={day} />
    </Map>
  )
}
