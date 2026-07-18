'use client'

import { useMemo, useState } from 'react'
import { DaySchedule, ITEM_TYPE_COLORS } from '@/lib/types'
import { buildDayMapUrl, stopLabel, MapLeg, MapStop } from '@/lib/staticMap'
import { formatDurationLabel } from '@/lib/utils'
import { legKey, mapStopsOf, RouteLeg } from '@/hooks/useDayRoutes'

interface DayRouteMapProps {
  day: DaySchedule
  legs: Map<string, RouteLeg>
  /** 하루 1페이지면 지면이 남으므로 지도를 키운다 */
  tall?: boolean
  /** 지도를 못 그릴 때 대신 보여줄 것 (CSS 다이어그램) */
  fallback: React.ReactNode
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export default function DayRouteMap({ day, legs, tall, fallback }: DayRouteMapProps) {
  const [failed, setFailed] = useState(false)
  const width = 640
  const height = tall ? 400 : 300

  const stops = mapStopsOf(day)

  // 매 렌더마다 URL 문자열이 새로 만들어지면 <img src>가 바뀌어 이미지를 다시 받는다(과금).
  const built = useMemo(() => {
    const mapStops: MapStop[] = stops.map((s) => ({ lat: s.location!.lat, lng: s.location!.lng, type: s.type }))
    const mapLegs: MapLeg[] = []
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i].location!
      const to = stops[i + 1].location!
      const mode = stops[i].transportToNext
      const leg = mode ? legs.get(legKey(from, to, mode)) : undefined
      mapLegs.push({
        encodedPolyline: leg?.encodedPolyline ?? null,
        mode,
        from: { lat: from.lat, lng: from.lng },
        to: { lat: to.lat, lng: to.lng },
      })
    }
    return buildDayMapUrl(mapStops, mapLegs, { width, height, apiKey: API_KEY })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.date, stops.length, legs, width, height])

  // 이동 합계 — 경로 조회의 부산물이라 공짜다
  const travel = useMemo(() => {
    let seconds = 0
    let meters = 0
    for (let i = 0; i < stops.length - 1; i++) {
      const mode = stops[i].transportToNext
      if (!mode) continue
      const leg = legs.get(legKey(stops[i].location!, stops[i + 1].location!, mode))
      if (!leg) continue
      seconds += leg.durationSeconds
      meters += leg.distanceMeters
    }
    return { seconds, meters }
  }, [stops, legs])

  if (!built || failed) return <>{fallback}</>

  return (
    <figure className="print-avoid-break mb-3">
      {/* aspect-ratio를 요청 크기에서 그대로 파생시킨다 — 어긋나면 지도가 늘어난다.
          loading은 eager여야 한다(lazy면 인쇄 시점에 비어 있을 수 있다). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={built.url}
        alt={`${day.date} 동선 지도`}
        loading="eager"
        onError={() => setFailed(true)}
        className="w-full rounded-lg border"
        style={{ aspectRatio: `${width} / ${height}` }}
      />

      <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-gray-600">
        {stops.map((s, i) => {
          const label = stopLabel(i)
          if (!label) return null
          return (
            <span key={s.id} className="flex items-center gap-1">
              <span
                className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[0.5rem] font-bold text-white"
                style={{ backgroundColor: ITEM_TYPE_COLORS[s.type] }}
              >
                {label}
              </span>
              {s.location!.name}
            </span>
          )
        })}
        {stops.length > 35 && <span>외 {stops.length - 35}곳</span>}
        {travel.seconds > 0 && (
          <span className="ml-auto shrink-0 text-gray-500">
            총 이동 {formatDurationLabel(Math.round(travel.seconds / 60))} · {(travel.meters / 1000).toFixed(1)}km
          </span>
        )}
      </figcaption>
    </figure>
  )
}
