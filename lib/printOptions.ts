export interface PrintOptions {
  map: boolean
  budget: boolean
  notes: boolean
  travel: boolean
  perDayPage: boolean
  /** false면 자동 인쇄 없이 미리보기만 — 옵션을 고쳐 다시 보거나 자동화 검증할 때 쓴다 */
  auto: boolean
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  map: true,
  budget: true,
  notes: true,
  travel: true,
  perDayPage: false,
  auto: true,
}

const STORAGE_KEY = 'travel-plan:print-options'

// 쿼리스트링으로 주고받는다 — window.open으로 새 탭을 열어도 따라가고, 새로고침에 견디고,
// 자동화 검증이 goto('?map=0&perday=1') 한 줄로 끝난다. 비트마스크는 디버깅이 어려워 피한다.
export function parsePrintOptions(params: URLSearchParams): PrintOptions {
  const flag = (key: string, fallback: boolean) => {
    const v = params.get(key)
    return v === null ? fallback : v === '1'
  }
  return {
    map: flag('map', DEFAULT_PRINT_OPTIONS.map),
    budget: flag('budget', DEFAULT_PRINT_OPTIONS.budget),
    notes: flag('notes', DEFAULT_PRINT_OPTIONS.notes),
    travel: flag('travel', DEFAULT_PRINT_OPTIONS.travel),
    perDayPage: flag('perday', DEFAULT_PRINT_OPTIONS.perDayPage),
    auto: flag('auto', DEFAULT_PRINT_OPTIONS.auto),
  }
}

export function serializePrintOptions(o: PrintOptions): string {
  // OFF도 항상 명시한다 — 기본값이 바뀌어도 링크의 의미가 변하지 않는다
  return new URLSearchParams({
    map: o.map ? '1' : '0',
    budget: o.budget ? '1' : '0',
    notes: o.notes ? '1' : '0',
    travel: o.travel ? '1' : '0',
    perday: o.perDayPage ? '1' : '0',
    auto: o.auto ? '1' : '0',
  }).toString()
}

/** 마지막 선택을 기억한다 — 매번 다시 체크하는 마찰을 없애고, 지도를 원치 않는 사용자가
 *  Static Maps 과금을 반복하지 않게 한다. */
export function loadSavedOptions(): PrintOptions {
  if (typeof window === 'undefined') return DEFAULT_PRINT_OPTIONS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PRINT_OPTIONS
    return { ...DEFAULT_PRINT_OPTIONS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PRINT_OPTIONS
  }
}

export function saveOptions(o: PrintOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...o, auto: true }))
  } catch {
    // 저장 실패는 기능에 영향 없음
  }
}
