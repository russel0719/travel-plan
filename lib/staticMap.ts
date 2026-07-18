import { ScheduleItemType, TransportType, ITEM_TYPE_COLORS, TRANSPORT_COLORS } from './types'
import { decodePolyline, encodePolyline, simplifyPath, LatLng } from './polyline'

const ENDPOINT = 'https://maps.googleapis.com/maps/api/staticmap'

// Static Maps 문서상 상한은 16384자지만, 중간 프록시/CDN을 감안해 여유를 둔다.
const URL_BUDGET = 8192

export interface MapStop {
  lat: number
  lng: number
  type: ScheduleItemType
}

export interface MapLeg {
  /** 이 구간의 도로 경로. 없으면 두 지점을 직선으로 잇는다 */
  encodedPolyline: string | null
  mode: TransportType | undefined
  from: LatLng
  to: LatLng
}

export interface DayMapOptions {
  width: number
  height: number
  apiKey: string
  language?: string
}

// Static Maps 마커 라벨은 단일 문자만 지원한다 — label:10은 라벨 없는 빈 마커로 렌더된다(실측).
// 그래서 10번째부터는 알파벳으로 넘긴다.
//
// ⚠️ 지도·범례·일정 목록·폴백 다이어그램이 전부 이 함수를 써야 한다. 라벨 규칙이 두 벌이 되면
// 같은 종이에 "10번"과 "A"가 동시에 나와 스스로 모순되는 문서가 된다.
export function stopLabel(index: number): string | null {
  if (index < 9) return String(index + 1)
  if (index < 35) return String.fromCharCode(65 + (index - 9)) // 'A'..'Z'
  return null // 라벨 없는 마커 — 범례에서 "외 N곳"으로 처리
}

// #3b82f6 → 0x3b82f6ff (Static Maps는 8자리 hex를 확실히 받는다)
function toMapColor(hex: string): string {
  return `0x${hex.replace('#', '').toLowerCase()}ff`
}

function buildUrl(params: string[][], apiKey: string): string {
  // 폴리라인에는 ? @ \ | 가 실제로 들어있다. |는 Static Maps 자체 구분자이고 ?는 쿼리 시작이라
  // 인코딩하지 않으면 요청이 깨진다. 반대로 두 번 인코딩하면 %가 %25가 되어 에러 없이 경로만
  // 조용히 사라진다 — 값마다 정확히 한 번만 encodeURIComponent를 태운다.
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return `${ENDPOINT}?${query}&key=${encodeURIComponent(apiKey)}`
}

function markerParams(stops: MapStop[]): string[][] {
  return stops.map((s, i) => {
    const label = stopLabel(i)
    const color = toMapColor(ITEM_TYPE_COLORS[s.type])
    const parts = [`color:${color}`]
    if (label) parts.push(`label:${label}`)
    else parts.push('size:small')
    parts.push(`${s.lat.toFixed(5)},${s.lng.toFixed(5)}`)
    return ['markers', parts.join('|')]
  })
}

function pathParam(points: LatLng[], mode: TransportType | undefined): string[] {
  const color = toMapColor(mode ? TRANSPORT_COLORS[mode] : '#6b7280')
  const encoded = encodePolyline(points)
  return ['path', `color:${color}|weight:4|enc:${encoded}`]
}

/**
 * 하루치 동선 지도 URL. 길이 예산을 넘으면 단계적으로 정보를 줄인다.
 *
 * center/zoom을 넣지 않는 이유: 마커와 경로의 합집합에 Google이 자동으로 fit 해준다.
 * 다만 정류지가 2개 미만이면 극단적으로 확대되므로 호출부가 그때는 지도를 아예 렌더하지 않는다.
 *
 * 반환값의 level은 어느 폴백 단계까지 내려갔는지를 알려준다(디버깅/검증용).
 */
export function buildDayMapUrl(
  stops: MapStop[],
  legs: MapLeg[],
  opts: DayMapOptions
): { url: string; level: 0 | 1 | 2 | 3 } | null {
  if (stops.length < 2 || !opts.apiKey) return null

  const base: string[][] = [
    ['size', `${opts.width}x${opts.height}`],
    ['scale', '2'],
    ['format', 'png'],
    ['language', opts.language ?? 'ko'],
    // POI 라벨이 많으면 우리 번호 마커가 묻힌다
    ['style', 'feature:poi|element:labels|visibility:off'],
  ]
  const markers = markerParams(stops)

  // 지도 1px이 실제로 몇 도인가 — 이보다 작은 굴곡은 인쇄물에서 보이지 않는다.
  const lngSpan = Math.max(...stops.map((s) => s.lng)) - Math.min(...stops.map((s) => s.lng))
  const degPerPixel = Math.abs(lngSpan) / Math.max(opts.width, 1)

  const decoded = legs.map((l) => ({
    leg: l,
    points: l.encodedPolyline ? decodePolyline(l.encodedPolyline) : [l.from, l.to],
  }))

  // L0: 원본 경로 그대로
  const l0 = buildUrl([...base, ...decoded.map((d) => pathParam(d.points, d.leg.mode)), ...markers], opts.apiKey)
  if (l0.length <= URL_BUDGET) return { url: l0, level: 0 }

  // L1: 인쇄 해상도에서 안 보이는 점을 버린다 — 보통 여기서 예산 안으로 들어온다
  const simplified = decoded.map((d) => ({ ...d, points: simplifyPath(d.points, degPerPixel) }))
  const l1 = buildUrl([...base, ...simplified.map((d) => pathParam(d.points, d.leg.mode)), ...markers], opts.apiKey)
  if (l1.length <= URL_BUDGET) return { url: l1, level: 1 }

  // L2: 도로 모양을 포기하고 정류지를 직선으로 잇는다 — 순서와 대략적 형태는 남는다
  const l2 = buildUrl(
    [...base, ...decoded.map((d) => pathParam([d.leg.from, d.leg.to], d.leg.mode)), ...markers],
    opts.apiKey
  )
  if (l2.length <= URL_BUDGET) return { url: l2, level: 2 }

  // L3: 마커만
  return { url: buildUrl([...base, ...markers], opts.apiKey), level: 3 }
}
