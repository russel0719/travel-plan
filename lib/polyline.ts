// Google encoded polyline algorithm (precision 5).
//
// Maps JS의 geometry.encoding을 쓰지 않는 이유: 인쇄 페이지에 Maps JS 로딩이라는 비동기 의존이
// 하나 더 생기고(인쇄 타이밍이 더 복잡해진다), Node에서 테스트할 수 없다. 순수 함수로 둔다.

export interface LatLng {
  lat: number
  lng: number
}

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0
      let shift = 0
      let byte: number
      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 'lat') lat += delta
      else lng += delta
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

function encodeSigned(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1
  let out = ''
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
    v >>= 5
  }
  out += String.fromCharCode(v + 63)
  return out
}

export function encodePolyline(points: LatLng[]): string {
  let lastLat = 0
  let lastLng = 0
  let out = ''
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5)
    const lng = Math.round(p.lng * 1e5)
    out += encodeSigned(lat - lastLat) + encodeSigned(lng - lastLng)
    lastLat = lat
    lastLng = lng
  }
  return out
}

// 점 p에서 선분 a-b까지의 수직거리 (도 단위 근사).
// 위도에 따른 경도 축소를 보정해야 고위도에서 과도하게 단순화되지 않는다.
function perpendicularDistance(p: LatLng, a: LatLng, b: LatLng): number {
  const cos = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  const px = (p.lng - a.lng) * cos
  const py = p.lat - a.lat
  const bx = (b.lng - a.lng) * cos
  const by = b.lat - a.lat
  const lenSq = bx * bx + by * by
  if (lenSq === 0) return Math.hypot(px, py)
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq))
  return Math.hypot(px - t * bx, py - t * by)
}

// Douglas–Peucker. 인쇄 해상도에서 보이지 않는 점을 버려 URL 길이를 줄이는 게 목적이다.
// 도로 폴리라인의 1.1m 정밀도(precision 5)는 A4에 인쇄하면 전부 낭비다.
export function simplifyPath(points: LatLng[], toleranceDeg: number): LatLng[] {
  if (points.length <= 2 || toleranceDeg <= 0) return points

  let maxDist = 0
  let index = 0
  const first = points[0]
  const last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last)
    if (d > maxDist) {
      maxDist = d
      index = i
    }
  }

  if (maxDist <= toleranceDeg) return [first, last]
  return [
    ...simplifyPath(points.slice(0, index + 1), toleranceDeg).slice(0, -1),
    ...simplifyPath(points.slice(index), toleranceDeg),
  ]
}
