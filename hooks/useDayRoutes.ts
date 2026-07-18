'use client'

import { useEffect, useRef, useState } from 'react'
import { DaySchedule, ScheduleItem, TransportType } from '@/lib/types'
import { fetchRoute, daySegments } from '@/lib/routes'

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
  // 어느 시그니처까지 조회를 끝냈는지. loading을 따로 두지 않고 이 값에서 파생시킨다 —
  // effect 안에서 동기적으로 setState하면 렌더가 연쇄된다.
  // null 센티널이어야 한다. ''로 두면 "조회할 구간이 없음"(signature === '')과 초기값이 같아져
  // 완료로 오인되거나 그 반대가 된다.
  const [resolved, setResolved] = useState<string | null>(null)
  const startedRef = useRef<string | null>(null)

  // 필요한 구간 목록을 원시값 문자열로 만든다 — 이게 effect의 유일한 트리거다
  const wanted: { key: LegKey; from: { lat: number; lng: number }; to: { lat: number; lng: number }; mode: TransportType }[] = []
  if (enabled) {
    for (const day of days) {
      for (const seg of daySegments(day.items)) {
        // 항공은 도로 경로가 없다 — 조회하지 않고 직선으로 둔다
        if (seg.mode === 'flight') continue
        const key = legKey(seg.from, seg.to, seg.mode)
        if (!wanted.some((w) => w.key === key)) {
          wanted.push({ key, from: seg.from, to: seg.to, mode: seg.mode })
        }
      }
    }
  }
  const signature = wanted.map((w) => w.key).join(';')

  useEffect(() => {
    if (!enabled) return
    if (startedRef.current === signature) return
    startedRef.current = signature

    // 조회할 구간이 없으면 상태를 건드릴 것도 없다 — 아래 loading 파생식이 이미 false를 낸다
    if (wanted.length === 0) return

    let cancelled = false
    const collected = new Map<LegKey, RouteLeg>()
    const misses = wanted.filter((w) => {
      const hit = readCache(w.key)
      if (hit) collected.set(w.key, hit)
      return !hit
    })

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
      setResolved(signature)
    })

    return () => {
      cancelled = true
    }
    // signature(원시 문자열)만 의존한다 — wanted 배열은 매 렌더 새 참조라 넣으면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled])

  // 조회할 구간이 있고, 그 조회가 아직 안 끝났을 때만 loading이다
  return { legs, loading: enabled && wanted.length > 0 && resolved !== signature }
}
