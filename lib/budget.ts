import { Trip, BudgetCategory, ITEM_TYPE_TO_BUDGET } from './types'

export const DEFAULT_LOCAL_CURRENCY = 'JPY'
export const DEFAULT_EXCHANGE_RATE = 9.5

// 일정 항목의 금액을 원화로 환산한다.
//
// 예전에는 이 함수가 BudgetTracker와 인쇄 페이지에 각각 정의되어 있었는데 동작이 달랐다 —
// 인쇄 쪽은 원화가 아닌 모든 통화에 현지 환율을 곱해서, JPY 여행에 USD 항목이 있으면
// 달러 금액에 엔화 환율을 적용했다. 그래서 같은 여행인데 화면 합계와 PDF 합계가 어긋났다.
// 사용자가 화면에서 계속 대조해 온 쪽(환산할 수 없는 통화는 건드리지 않는다)을 기준으로 통일한다.
export function toKRW(price: number, currency: string, localCurrency: string, exchangeRate: number): number {
  if (currency === 'KRW' || currency === '₩') return price
  if (currency === localCurrency || currency === '¥') return Math.round(price * exchangeRate)
  return price
}

// 실제 지출 = 일정 항목 금액 + 항공 + 숙박. 카테고리별로 합산한다.
export function computeActuals(trip: Trip): Partial<Record<BudgetCategory, number>> {
  const localCurrency = trip.budget?.localCurrency ?? DEFAULT_LOCAL_CURRENCY
  const rate = trip.budget?.exchangeRate ?? DEFAULT_EXCHANGE_RATE
  const totals: Partial<Record<BudgetCategory, number>> = {}

  for (const day of trip.days) {
    for (const item of day.items) {
      // 0원은 건너뛴다 — 합계에는 영향이 없지만, 넣으면 값이 0인 카테고리 행이 새로 생긴다
      if (!item.price) continue
      const category = ITEM_TYPE_TO_BUDGET[item.type]
      totals[category] =
        (totals[category] ?? 0) + toKRW(item.price, item.currency ?? localCurrency, localCurrency, rate)
    }
  }

  const flightTotal = (trip.flights ?? []).reduce((sum, f) => sum + (f.priceKRW ?? 0), 0)
  const hotelTotal = (trip.accommodations ?? []).reduce((sum, a) => sum + (a.priceKRW ?? 0), 0)
  if (flightTotal) totals.flight = (totals.flight ?? 0) + flightTotal
  if (hotelTotal) totals.hotel = (totals.hotel ?? 0) + hotelTotal

  return totals
}
