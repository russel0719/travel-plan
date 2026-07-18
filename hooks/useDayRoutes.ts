'use client'

import { useEffect, useRef, useState } from 'react'
import { DaySchedule, ScheduleItem, TransportType } from '@/lib/types'
import { fetchRoute } from '@/lib/routes'

export interface RouteLeg {
  encodedPolyline: string | null
  durationSeconds: number
  distanceMeters: number
}

/** `${lat},${lng}>${lat},${lng}|mode` — 구간의 고유 키 */
type LegKey = string

export interface DayRoutes {
  /** legKey → 조회 결과. 실패한 구간은 없다(직선으로 폴백) */
  legs: Map<LegKey, RouteLeg>
  loading: boolean
}

const CACHE_PREFIX = 'travel-plan:route:'
const CACHE_TTL_MS = 60 * 60 * 1000
const CONCURRENCY = 6

export function legKey(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode?: TransportType): LegKey {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}|${mode ?? '-'}`
}

/** 지도에 표시할 정류지 — 좌표가 있고 이동 자체가 아닌 항목 */
export function mapStopsOf(day: DaySchedule): ScheduleItem[] {
  return day.items.filter((i) => i.location && i.location.lat !== 0 && i.location.lng !== 0 && i.type !== 'transport')
}

function readCache(key: LegKey): RouteLeg | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { at, leg } = JSON.parse(raw)
    if (Date.now() - at > CACHE_TTL_MS) return null
    return leg as RouteLeg
  } catch {
    return null
  }
}

function writeCache(key: LegKey, leg: RouteLeg) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), leg }))
  } catch {
    // 용량 초과 등 — 캐시는 최적화일 뿐이라 조용히 넘어간다
  }
}

async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const i = cursor++
      await tasks[i]()
    }
  })
  await Promise.all(workers)
}

/**
 * 전 일자의 인접 구간 경로를 한 번에 가져온다.
 *
 * 과금이 걸린 코드라 세 가지를 지킨다:
 *  1. 구간 중복제거 — 호텔↔관광지 왕복처럼 같은 구간이 반복되는 일이 흔하다
 *  2. sessionStorage 캐시 — 옵션을 바꿔 다시 인쇄해도 재호출하지 않는다
 *  3. 원시값 시그니처로만 재실행 — trip 객체를 deps에 넣으면 store가 바뀔 때마다
 *     identity가 달라져 무한 재호출이 된다(눈에 보이지 않는 비용이다)
 */
export function useDayRoutes(days: DaySchedule[], enabled: boolean): DayRoutes {
  const [legs, setLegs] = useState<Map<LegKey, RouteLeg>>(new Map())
  const [loading, setLoading] = useState(enabled)
  // null 센티널이어야 한다. ''로 두면 "조회할 구간이 없음"(signature === '')과 초기값이 같아져
  // effect가 조기 반환하고 loading이 영영 true로 남는다 — 인쇄 게이트가 열리지 않는다.
  const doneRef = useRef<string | null>(null)

  // 필요한 구간 목록을 원시값 문자열로 만든다 — 이게 effect의 유일한 트리거다
  const wanted: { key: LegKey; from: { lat: number; lng: number }; to: { lat: number; lng: number }; mode: TransportType }[] = []
  if (enabled) {
    for (const day of days) {
      const stops = mapStopsOf(day)
      for (let i = 0; i < stops.length - 1; i++) {
        const from = stops[i].location!
        const to = stops[i + 1].location!
        const mode = stops[i].transportToNext
        // flight은 도로 경로 대상이 아니고, 이동수단이 없으면 직선으로 둔다
        if (!mode || mode === 'flight') continue
        const key = legKey(from, to, mode)
        if (!wanted.some((w) => w.key === key)) wanted.push({ key, from, to, mode })
      }
    }
  }
  const signature = wanted.map((w) => w.key).join(';')

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (doneRef.current === signature) return
    doneRef.current = signature

    if (wanted.length === 0) {
      setLoading(false)
      return
    }

    let cancelled = false
    const collected = new Map<LegKey, RouteLeg>()
    const misses = wanted.filter((w) => {
      const hit = readCache(w.key)
      if (hit) collected.set(w.key, hit)
      return !hit
    })

    setLoading(true)
    runPool(
      misses.map((w) => async () => {
        const r = await fetchRoute(w.from, w.to, w.mode, false)
        if (!r) return // 구간 단위 실패는 그 구간만 직선으로 — 하루 전체를 죽이지 않는다
        const leg: RouteLeg = {
          encodedPolyline: r.encodedPolyline,
          durationSeconds: r.durationSeconds,
          distanceMeters: r.distanceMeters,
        }
        collected.set(w.key, leg)
        writeCache(w.key, leg)
      }),
      CONCURRENCY
    ).then(() => {
      if (cancelled) return
      setLegs(collected)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // signature(원시 문자열)만 의존한다 — wanted 배열은 매 렌더 새 참조라 넣으면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled])

  return { legs, loading }
}
