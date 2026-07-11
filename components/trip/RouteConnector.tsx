'use client'

import { useEffect, useState } from 'react'
import { Location, TransportType } from '@/lib/types'
import { fetchRoute } from '@/lib/routes'

interface RouteConnectorProps {
  origin: Location
  destination: Location
  mode: TransportType
}

const MODE_ICON: Record<TransportType, string> = {
  walk: '🚶',
  public: '🚌',
  car: '🚗',
  taxi: '🚕',
  flight: '✈️',
}

// 연속된 두 일정 사이의 실제 이동시간/거리를 Google Routes API로 계산해 보여준다.
// 정보를 가져오지 못하면(서버 키 미설정, 경로 계산 불가 등) 아무것도 렌더링하지 않는다.
export default function RouteConnector({ origin, destination, mode }: RouteConnectorProps) {
  const [info, setInfo] = useState<{ durationSeconds: number; distanceMeters: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchRoute({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng }, mode).then(
      (result) => {
        if (!cancelled) setInfo(result)
      }
    )
    return () => {
      cancelled = true
    }
  }, [origin.lat, origin.lng, destination.lat, destination.lng, mode])

  if (!info) return null

  const minutes = Math.round(info.durationSeconds / 60)
  const km = (info.distanceMeters / 1000).toFixed(1)

  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1 pl-8 py-0.5">
      <span>{MODE_ICON[mode]}</span>
      <span>{minutes}분 · {km}km</span>
    </p>
  )
}
