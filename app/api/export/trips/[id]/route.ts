import { NextRequest } from 'next/server'
import {
  adminClient,
  authorize,
  EXPORT_VERSION,
  exportUserId,
  FLIGHT_COLUMNS,
  json,
  LODGING_COLUMNS,
  SCHEDULE_COLUMNS,
  TRIP_COLUMNS,
} from '@/lib/exportApi'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/export/trips/<id> — 여행 하나의 일정·항공편·숙소(좌표만). 읽기 전용 — lib/exportApi.ts 참고.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorize(req)
  if (denied) return denied

  const { id } = await params
  if (!UUID.test(id)) return json({ error: '여행 id 형식이 아닙니다' }, 400)

  const db = adminClient()
  const trip = await db.from('trips').select(TRIP_COLUMNS).eq('id', id).eq('user_id', exportUserId()).maybeSingle()
  if (trip.error) return json({ error: `trips 조회 실패: ${trip.error.message}` }, 502)
  if (!trip.data) return json({ error: '그런 여행이 없습니다' }, 404)

  // 자식 테이블 하나가 실패해도 나머지는 돌려준다 — 실패한 테이블을 errors 로 알린다 (앱의 읽기와 같은 원칙)
  const [schedule, flights, lodging] = await Promise.all([
    db.from('schedule_items').select(SCHEDULE_COLUMNS).eq('trip_id', id).order('day_date').order('position'),
    db.from('flights').select(FLIGHT_COLUMNS).eq('trip_id', id).order('departure_date'),
    db.from('accommodations').select(LODGING_COLUMNS).eq('trip_id', id).order('check_in_date'),
  ])
  const errors = Object.entries({ schedule, flights, lodging })
    .filter(([, r]) => r.error)
    .map(([k, r]) => `${k}: ${r.error!.message}`)

  return json({
    version: EXPORT_VERSION,
    trip: trip.data,
    schedule: schedule.data ?? [],
    flights: flights.data ?? [],
    lodging: lodging.data ?? [],
    ...(errors.length ? { errors } : {}),
  })
}
