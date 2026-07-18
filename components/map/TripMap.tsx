'use client'

import { useMemo } from 'react'
import { DaySchedule, ITEM_TYPE_COLORS } from '@/lib/types'
import { fetchRoute, daySegments } from '@/lib/routes'
import MapMock from './MapMock'
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps'
import { useEffect } from 'react'

// 동선 색 — 이동수단과 무관하게 전부 이 색으로 그린다.
//
// 파란 계열을 쓰면 바탕의 물·철도·고속도로 표지와 섞여 묻힌다. 로즈는 Google 기본 지도가
// 면이나 선에 쓰지 않는 색이고, 마커 팔레트(파랑·앰버·보라·회색)와도 겹치지 않는다.
const ROUTE_COLOR = '#e11d48'
// 선 밑에 까는 테두리 — 지도 바탕에서 선을 떼어내 가시성을 만든다
const CASING_COLOR = '#ffffff'
const LINE_WEIGHT = 5

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
        // 동선은 수단과 무관하게 한 색으로 그린다. 수단별로 색을 나눴더니 파란 대중교통 구간이
        // 바탕에 묻혔고, 한 여행 안에서 선 색이 여러 개면 "무슨 색이 무슨 뜻인지" 지도만 보고는
        // 알 수 없었다. 수단 구분은 실선/점선과 일정 목록이 맡는다.
        const color = ROUTE_COLOR

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

        // 흰 테두리를 깔고 그 위에 색 선을 얹는다(케이싱).
        // 지도 바탕에는 파란 계열(물·철도·고속도로 표지)이 많아 선 하나만 그리면 묻힌다.
        // 흰 테두리가 주변과 선 사이에 여백을 만들어 어떤 바탕 위에서도 선이 떠 보이게 한다 —
        // Google 자체 길찾기도 같은 방식이다.
        // 테두리는 점선 구간에서도 실선으로 깐다. 흰 점선과 색 점선을 번갈아 그리면 전체가
        // 옅어져 오히려 더 안 보인다 — 흰 실선 위에 색 점선을 얹어야 점선이 또렷해진다.
        lines.push(
          new g.Polyline({
            path,
            geodesic: true,
            strokeColor: CASING_COLOR,
            strokeOpacity: 1,
            strokeWeight: LINE_WEIGHT + 4,
            zIndex: 1,
            map,
          })
        )
        lines.push(
          new g.Polyline({
            path,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: isDashed ? 0 : 1,
            strokeWeight: LINE_WEIGHT,
            icons: isDashed
              ? [
                  {
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      strokeWeight: LINE_WEIGHT,
                      scale: 1.6,
                      strokeColor: color,
                    },
                    offset: '0',
                    repeat: '14px',
                  },
                ]
              : [],
            zIndex: 2,
            map,
          })
        )
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
