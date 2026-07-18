'use client'

// 임시 검증용 — 확인 후 삭제.
// 인쇄 페이지는 로그인이 필요한 store를 읽으므로, 샘플 여행을 직접 주입해 우회한다.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTripStore } from '@/store/tripStore'
import { SAMPLE_TRIP } from '@/lib/sampleData'
import { Trip, ScheduleItem } from '@/lib/types'

// 페이지 나눔 검증용: 항목이 많은 하루를 만든다
function makeLongDay(base: Trip): Trip {
  const day0 = base.days[0]
  const extra: ScheduleItem[] = Array.from({ length: 20 }, (_, i) => ({
    id: `long-${i}`,
    type: 'attraction' as const,
    title: `채우기 일정 ${i + 1}`,
    startTime: `${String(8 + Math.floor(i / 3)).padStart(2, '0')}:00`,
    endTime: `${String(9 + Math.floor(i / 3)).padStart(2, '0')}:00`,
    notes: '페이지 나눔 검증용 메모입니다.\n두 번째 줄\n세 번째 줄',
  }))
  return {
    ...base,
    days: [{ ...day0, items: [...day0.items, ...extra] }, ...base.days.slice(1)],
  }
}

export default function DevPrintTest() {
  const [mode, setMode] = useState<'normal' | 'long'>('normal')

  useEffect(() => {
    const trip = mode === 'long' ? makeLongDay(SAMPLE_TRIP) : SAMPLE_TRIP
    // ⚠️ userId는 반드시 null로 둔다. store의 subscribe가 `!userId`면 조기 반환하므로,
    // 값을 넣으면 이 가짜 샘플 여행이 사용자의 실제 DB로 upsert된다.
    useTripStore.setState({ trips: [trip], hydrated: true, userId: null })
  }, [mode])

  return (
    <div className="space-y-2 p-4 text-sm">
      <p>주입됨 ({mode})</p>
      <button className="rounded border px-2 py-1" onClick={() => setMode('long')}>
        긴 하루로 전환
      </button>
      {/* Link로 클라이언트 이동해야 store가 유지된다 (직접 goto하면 새로고침이라 store가 비워짐).
          쿼리는 Link의 href에 직접 넣어야 한다 — DOM 속성을 바꿔도 Next는 자체 props로 라우팅한다. */}
      <Link href={`/trip/${SAMPLE_TRIP.id}/print`} className="block underline">
        인쇄 페이지로
      </Link>
      <Link href={`/trip/${SAMPLE_TRIP.id}/print?map=0&auto=0`} className="block underline">
        지도 OFF
      </Link>
      <Link href={`/trip/${SAMPLE_TRIP.id}/print?map=0&budget=0&perday=1&auto=0`} className="block underline">
        지도OFF+예산OFF+하루1페이지
      </Link>
    </div>
  )
}
