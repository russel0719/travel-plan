'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import {
  Trip, ScheduleItem, DaySchedule,
  ITEM_TYPE_LABELS, ITEM_TYPE_COLORS,
  BUDGET_CATEGORY_LABELS, ITEM_TYPE_TO_BUDGET, BudgetCategory,
} from '@/lib/types'
import { formatDate, getDayLabel } from '@/lib/utils'
import { Printer, ArrowLeft, MapPin, Clock, Ticket, Phone, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ id: string }>
}

/* ── 유틸 ── */
function toKRW(price: number, currency: string, localCurrency: string, rate: number) {
  if (currency === 'KRW' || currency === '₩') return price
  return Math.round(price * rate)
}

function computeActuals(trip: Trip) {
  const lc = trip.budget?.localCurrency ?? 'JPY'
  const rate = trip.budget?.exchangeRate ?? 9.5
  const map: Partial<Record<BudgetCategory, number>> = {}
  for (const day of trip.days)
    for (const item of day.items)
      if (item.price) {
        const cat = ITEM_TYPE_TO_BUDGET[item.type]
        map[cat] = (map[cat] ?? 0) + toKRW(item.price, item.currency ?? lc, lc, rate)
      }
  const ft = (trip.flights ?? []).reduce((s, f) => s + (f.priceKRW ?? 0), 0)
  const ht = (trip.accommodations ?? []).reduce((s, a) => s + (a.priceKRW ?? 0), 0)
  if (ft) map['flight'] = (map['flight'] ?? 0) + ft
  if (ht) map['hotel'] = (map['hotel'] ?? 0) + ht
  return map
}

/* ── 동선 다이어그램 (줄바꿈 지원) ── */
function RouteDiagram({ day }: { day: DaySchedule }) {
  const stops = day.items.filter(
    (i) => i.location && i.location.lat !== 0 && i.location.lng !== 0 && i.type !== 'transport'
  )
  if (stops.length === 0) return null

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-start gap-y-3">
        {stops.map((item, idx) => {
          const color = ITEM_TYPE_COLORS[item.type]
          const isLast = idx === stops.length - 1
          const markerNum = idx + 1

          return (
            <div key={item.id} className="flex items-start">
              {/* 마커 + 라벨 */}
              <div className="flex flex-col items-center" style={{ width: 68 }}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {markerNum}
                </div>
                <p className="text-center text-[9px] text-gray-500 mt-1 leading-tight px-1 break-words w-full">
                  {item.location!.name}
                </p>
                {item.time && (
                  <p className="text-[9px] text-gray-400 tabular-nums">{item.time}</p>
                )}
              </div>
              {/* 연결 화살표 */}
              {!isLast && (
                <div className="flex items-center mt-3 mx-0.5">
                  <div className="h-px bg-gray-300" style={{ width: 16 }} />
                  <svg width="5" height="8" viewBox="0 0 5 8" fill="none" className="shrink-0">
                    <path d="M0 0L5 4L0 8" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── 일정 항목 행 ── */
function ScheduleItemRow({ item, localCurrency }: { item: ScheduleItem; localCurrency?: string }) {
  const color = ITEM_TYPE_COLORS[item.type]
  // 마커 번호 표시용 — 부모에서 index 넘겨받으면 더 정확하지만 여기선 위치 여부만 활용
  return (
    <div className="flex items-start gap-2 py-[3px]">
      {/* 색상 바 */}
      <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {item.time && (
            <span className="text-[10px] text-gray-400 tabular-nums w-9 shrink-0 flex items-center gap-0.5">
              <Clock className="h-2 w-2" />{item.time}
            </span>
          )}
          <span
            className="text-[10px] px-1 py-px rounded border font-medium shrink-0"
            style={{ color, borderColor: color }}
          >
            {ITEM_TYPE_LABELS[item.type]}
          </span>
          <span className="text-[11px] font-medium">{item.title}</span>
          {item.price && (
            <span className="ml-auto text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
              {item.price.toLocaleString()} {item.currency ?? localCurrency ?? ''}
            </span>
          )}
        </div>
        {(item.location?.name || item.notes) && (
          <div className="ml-[calc(2.25rem+0.375rem)] text-[10px] text-gray-400 space-y-px mt-px">
            {item.location?.name && (
              <p className="flex items-center gap-0.5">
                <MapPin className="h-2 w-2 shrink-0" />{item.location.name}
              </p>
            )}
            {item.notes && <p className="line-clamp-1">{item.notes}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 메인 ── */
export default function PrintPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { hydrated, hydrate, getTrip } = useTripStore()
  const [printed, setPrinted] = useState(false)

  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])

  const trip = getTrip(id)

  useEffect(() => { if (hydrated && !trip) router.push('/') }, [hydrated, trip, router])

  useEffect(() => {
    if (trip && !printed) {
      const t = setTimeout(() => { window.print(); setPrinted(true) }, 600)
      return () => clearTimeout(t)
    }
  }, [trip, printed])

  if (!hydrated || !trip) return null

  const nights = trip.days.length - 1
  const actuals = computeActuals(trip)
  const totalActual = Object.values(actuals).reduce((s, v) => s + (v ?? 0), 0)
  const totalPlanned = (trip.budget?.items ?? []).reduce((s, i) => s + i.plannedKRW, 0)
  const hasBudget = (trip.budget?.items ?? []).length > 0

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* 화면 전용 컨트롤 */}
      <div className="print-hide sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />돌아가기
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1.5" />인쇄 / PDF 저장
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white print:max-w-none print:mx-0 my-8 print:my-0 shadow-xl print:shadow-none">
        <div className="px-12 py-10 print:px-10 print:py-8 space-y-7">

          {/* ── 제목 헤더 ── */}
          <header className="print-avoid-break border-b-2 border-gray-900 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight leading-none">{trip.title}</h1>
                <p className="text-gray-400 mt-2 text-sm flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{trip.destination}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-base">{formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}</p>
                <p className="text-sm text-gray-500 mt-0.5">{nights}박 {trip.days.length}일</p>
                {trip.isInternational && (
                  <span className="inline-block mt-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">해외여행</span>
                )}
              </div>
            </div>

            {/* ── 항공 + 숙박 컴팩트 ── */}
            {trip.isInternational && ((trip.flights ?? []).length > 0 || (trip.accommodations ?? []).length > 0) && (
              <div className="mt-4 space-y-1.5">
                {(trip.flights ?? []).map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-[11px] bg-indigo-50 rounded px-3 py-1.5">
                    <span className="font-semibold text-indigo-700 w-6 shrink-0">
                      {f.direction === 'outbound' ? '↗' : '↙'}
                    </span>
                    <span className="font-semibold text-gray-700">{f.airline} {f.flightNumber}</span>
                    <span className="text-gray-500 mx-1">|</span>
                    <span className="text-gray-600">
                      {f.departureAirport} <strong>{f.departureTime}</strong>
                      {' → '}
                      {f.arrivalAirport} <strong>{f.arrivalTime}</strong>
                    </span>
                    <span className="text-gray-400">{f.departureDate}</span>
                    {f.bookingRef && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-0.5 text-gray-500">
                          <Ticket className="h-2.5 w-2.5" />{f.bookingRef}
                        </span>
                      </>
                    )}
                    {f.priceKRW && (
                      <span className="ml-auto font-semibold text-gray-700">₩{f.priceKRW.toLocaleString()}</span>
                    )}
                  </div>
                ))}
                {(trip.accommodations ?? []).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-[11px] bg-violet-50 rounded px-3 py-1.5 flex-wrap">
                    <span className="font-semibold text-violet-700 w-6 shrink-0">🏨</span>
                    <span className="font-semibold text-gray-700">{a.name}</span>
                    {a.address && <span className="text-gray-400">{a.address}</span>}
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-600">
                      체크인 <strong>{a.checkInDate?.slice(5)}</strong>{a.checkInTime && ` ${a.checkInTime}`}
                      {' ~ '}
                      체크아웃 <strong>{a.checkOutDate?.slice(5)}</strong>{a.checkOutTime && ` ${a.checkOutTime}`}
                    </span>
                    {(a.bookingPlatform || a.bookingRef) && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1 text-gray-500">
                          {a.bookingPlatform}
                          {a.bookingRef && (
                            <span className="flex items-center gap-0.5">
                              <Ticket className="h-2.5 w-2.5" />{a.bookingRef}
                            </span>
                          )}
                        </span>
                      </>
                    )}
                    {a.phone && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-0.5 text-gray-500">
                          <Phone className="h-2.5 w-2.5" />{a.phone}
                        </span>
                      </>
                    )}
                    {a.priceKRW && (
                      <span className="ml-auto font-semibold text-gray-700">₩{a.priceKRW.toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </header>

          {/* ── 일자별 일정 ── */}
          {trip.days.map((day, idx) => (
            <section key={day.date} className="print-avoid-break space-y-2">
              {/* 날짜 제목 */}
              <div className="flex items-center gap-2.5 border-b pb-1.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0">
                  {idx + 1}
                </span>
                <h2 className="text-base font-bold">{getDayLabel(idx)}</h2>
                <span className="text-sm text-gray-400 font-normal">{formatDate(day.date)}</span>
                <span className="ml-auto text-xs text-gray-400">{day.items.length}개 일정</span>
              </div>

              {day.items.length === 0 ? (
                <p className="text-xs text-gray-400 italic pl-8">일정 없음</p>
              ) : (
                <>
                  {/* 동선 다이어그램 */}
                  <RouteDiagram day={day} />
                  {/* 일정 목록 */}
                  <div className="space-y-0.5 pl-1 border-l-2 border-gray-100 ml-1">
                    {day.items.map((item) => (
                      <ScheduleItemRow key={item.id} item={item} localCurrency={trip.budget?.localCurrency} />
                    ))}
                  </div>
                </>
              )}
            </section>
          ))}

          {/* ── 예산 요약 ── */}
          {hasBudget && (
            <section className="print-avoid-break space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2 border-b pb-1.5">
                <Wallet className="h-4 w-4" />예산 요약
              </h2>
              <div className="grid grid-cols-[1fr_auto] gap-6 items-start">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left pb-1 font-semibold">항목</th>
                      <th className="text-right pb-1 font-semibold">예산</th>
                      <th className="text-right pb-1 font-semibold">실지출</th>
                      <th className="text-right pb-1 font-semibold w-20">차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.budget!.items.map((bi) => {
                      const actual = actuals[bi.category] ?? 0
                      const diff = bi.plannedKRW - actual
                      const over = diff < 0
                      return (
                        <tr key={bi.id} className="border-b border-gray-50">
                          <td className="py-[3px] text-gray-700">{bi.label || BUDGET_CATEGORY_LABELS[bi.category]}</td>
                          <td className="py-[3px] text-right text-gray-500">₩{bi.plannedKRW.toLocaleString()}</td>
                          <td className="py-[3px] text-right">{actual ? `₩${actual.toLocaleString()}` : <span className="text-gray-300">-</span>}</td>
                          <td className={`py-[3px] text-right font-semibold ${over ? 'text-red-500' : actual ? 'text-emerald-600' : 'text-gray-300'}`}>
                            {actual ? `${over ? '+' : '-'}₩${Math.abs(diff).toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-sm border-t">
                      <td className="pt-1.5">합계</td>
                      <td className="pt-1.5 text-right">₩{totalPlanned.toLocaleString()}</td>
                      <td className="pt-1.5 text-right">₩{totalActual.toLocaleString()}</td>
                      <td className={`pt-1.5 text-right ${totalActual > totalPlanned ? 'text-red-500' : 'text-emerald-600'}`}>
                        {totalActual > totalPlanned ? '+' : '-'}₩{Math.abs(totalPlanned - totalActual).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <div className="text-right space-y-1 shrink-0">
                  {trip.budget && (
                    <p className="text-[10px] text-gray-400">
                      1 {trip.budget.localCurrency} = ₩{trip.budget.exchangeRate}
                    </p>
                  )}
                  <div className={`rounded px-3 py-2 text-right ${totalActual <= totalPlanned ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className="text-[10px] text-gray-500">예산 대비</p>
                    <p className={`text-base font-bold ${totalActual <= totalPlanned ? 'text-emerald-600' : 'text-red-500'}`}>
                      {totalActual <= totalPlanned ? '절약' : '초과'}
                    </p>
                    <p className={`text-sm font-semibold ${totalActual <= totalPlanned ? 'text-emerald-600' : 'text-red-500'}`}>
                      ₩{Math.abs(totalPlanned - totalActual).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── 푸터 ── */}
          <footer className="border-t pt-3 text-center text-[10px] text-gray-300 print-avoid-break">
            여행 플래너 · {new Date().toLocaleDateString('ko-KR')} 출력
          </footer>
        </div>
      </div>
    </div>
  )
}
