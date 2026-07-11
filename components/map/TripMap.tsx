'use client'

import { useMemo } from 'react'
import { DaySchedule, ITEM_TYPE_COLORS, TRANSPORT_COLORS } from '@/lib/types'
import { fetchRoute } from '@/lib/routes'
import MapMock from './MapMock'
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps'
import { useEffect } from 'react'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

interface RouteLayerProps {
  day: DaySchedule
}

function RouteLayer({ day }: RouteLayerProps) {
  const map = useMap()

  const points = useMemo(
    () => day.items.filter((i) => i.location && i.location.lat !== 0),
    [day]
  )

  useEffect(() => {
    if (!map || points.length < 2) return

    const g = (window as unknown as { google: typeof google }).google.maps
    const lines: google.maps.Polyline[] = []
    let cancelled = false

    const draw = async () => {
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i].location!
        const to = points[i + 1].location!
        const mode = points[i].transportToNext
        const color = mode ? TRANSPORT_COLORS[mode] : '#6b7280'
        const isDashed = mode === 'flight'

        // 실제 도로 경로를 못 가져오면(서버 키 미설정, 항공 구간 등) 직선으로 폴백한다.
        let path: google.maps.LatLngLiteral[] = [
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
        ]

        if (mode && mode !== 'flight') {
          const route = await fetchRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }, mode)
          if (route?.encodedPolyline) {
            path = g.geometry.encoding
              .decodePath(route.encodedPolyline)
              .map((p) => ({ lat: p.lat(), lng: p.lng() }))
          }
        }

        if (cancelled) return

        const line = new g.Polyline({
          path,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: isDashed ? 0 : 0.8,
          strokeWeight: 3,
          icons: isDashed
            ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, scale: 3 }, offset: '0', repeat: '10px' }]
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
  }, [map, points])

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
