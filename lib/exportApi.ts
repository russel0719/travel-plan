import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 내보내기 API(app/api/export/*) 공용 — 서버 전용.
//
// 다른 앱(taleframe: 여행 후기 사이트)이 이 앱의 계획을 **읽기만** 하려고 부른다.
// 그쪽은 DB 키를 갖지 않고 개인 토큰 하나만 갖는다. 여기서 service_role 로 읽되,
//   · EXPORT_USER_ID 한 사람의 여행만
//   · 아래 *_COLUMNS 에 적은 필드만 (예약번호·전화·좌석·숙소 주소·가격은 고르지 않는다)
// 내보낸다. 응답 모양은 EXPORT_VERSION 으로 약속한다 — 컬럼을 바꿔도 이 모양은 지킨다.

export const EXPORT_VERSION = 1

export const TRIP_COLUMNS = 'id,title,destination,start_date,end_date,is_international'
export const SCHEDULE_COLUMNS = [
  'id,day_date,position,type,title,start_time,end_time',
  'location_name,location_lat,location_lng,location_address,location_place_id',
  'from_location_name,from_location_lat,from_location_lng',
  'transport_mode,meal_type,check_type,notes,price,currency',
].join(',')
export const FLIGHT_COLUMNS =
  'id,direction,airline,flight_number,departure_airport,departure_date,departure_time,arrival_airport,arrival_date,arrival_time'
// 숙소는 이름·좌표·날짜만 — 주소·전화·예약 정보는 내보내지 않는다
export const LODGING_COLUMNS = 'id,name,check_in_date,check_out_date,lat,lng'

const DATE = /^\d{4}-\d{2}-\d{2}$/
export const isDate = (v: string | null): v is string => !!v && DATE.test(v)

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** 토큰이 맞으면 null, 아니면 돌려보낼 응답. 설정이 하나라도 없으면 기능이 꺼진 것(503)이다 */
export function authorize(req: Request): NextResponse | null {
  const token = process.env.EXPORT_API_TOKEN
  if (!token || !process.env.EXPORT_USER_ID || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: '내보내기 API가 설정되지 않았습니다 (EXPORT_API_TOKEN · EXPORT_USER_ID · SUPABASE_SERVICE_ROLE_KEY)' }, 503)
  }
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  // 길이가 달라도 시간 차가 나지 않게 해시끼리 비교한다
  const a = createHash('sha256').update(got).digest()
  const b = createHash('sha256').update(token).digest()
  if (!got || !timingSafeEqual(a, b)) return json({ error: '토큰이 맞지 않습니다' }, 401)
  return null
}

export const exportUserId = () => process.env.EXPORT_USER_ID!

/** service_role 클라이언트 — RLS 를 우회하므로 반드시 user_id 로 직접 거른다 */
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: 'app_travel_plan' },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
