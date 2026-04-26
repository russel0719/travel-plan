'use client'

import { useMemo } from 'react'
import { DaySchedule, ITEM_TYPE_COLORS, TRANSPORT_COLORS } from '@/lib/types'
import MapMock from './MapMock'
import {
  APIProvider,
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

    const { Polyline } = (window as any).google.maps
    const lines: any[] = []

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i].location!
      const to = points[i + 1].location!
      const color = points[i].transportToNext
        ? TRANSPORT_COLORS[points[i].transportToNext!]
        : '#6b7280'
      const isDashed = points[i].transportToNext === 'flight'

      const line = new Polyline({
        path: [
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
        ],
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

    return () => lines.forEach((l) => l.setMap(null))
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
    <APIProvider apiKey={API_KEY}>
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
    </APIProvider>
  )
}
