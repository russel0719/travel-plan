import { NextRequest } from 'next/server'
import { adminClient, authorize, EXPORT_VERSION, exportUserId, isDate, json, TRIP_COLUMNS } from '@/lib/exportApi'

export const dynamic = 'force-dynamic'

// GET /api/export/trips?from=YYYY-MM-DD&to=YYYY-MM-DD
// 그 기간과 겹치는 여행 목록 (from·to 가 없으면 최근 50개). 읽기 전용 — lib/exportApi.ts 참고.
export async function GET(req: NextRequest) {
  const denied = authorize(req)
  if (denied) return denied

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  if ((from && !isDate(from)) || (to && !isDate(to))) return json({ error: 'from·to 는 YYYY-MM-DD' }, 400)

  let q = adminClient().from('trips').select(TRIP_COLUMNS).eq('user_id', exportUserId())
  // 겹침: 여행 시작 ≤ to 이고 여행 끝 ≥ from
  if (to) q = q.lte('start_date', to)
  if (from) q = q.gte('end_date', from)
  const { data, error } = await q.order('start_date', { ascending: false }).limit(50)
  if (error) return json({ error: `trips 조회 실패: ${error.message}` }, 502)
  return json({ version: EXPORT_VERSION, trips: data })
}
