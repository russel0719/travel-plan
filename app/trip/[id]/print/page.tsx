'use client'

import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import {
  ScheduleItem, DaySchedule,
  ITEM_TYPE_LABELS, ITEM_TYPE_COLORS,
  BUDGET_CATEGORY_LABELS, BudgetCategory,
  MEAL_TYPE_LABELS, CHECK_TYPE_LABELS, TRANSPORT_LABELS,
} from '@/lib/types'
import { computeActuals } from '@/lib/budget'
import { formatDate, formatTimeRange, getDayLabel } from '@/lib/utils'
import { useDayRoutes } from '@/hooks/useDayRoutes'
import { parsePrintOptions } from '@/lib/printOptions'
import { waitForAssets, sanitizeFilename } from '@/lib/printReady'
import DayRouteMap from '@/components/print/DayRouteMap'
import { Printer, ArrowLeft, MapPin, Clock, Ticket, Phone, Wallet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ id: string }>
}

/* ── 동선 다이어그램 (줄바꿈 지원) ── */
function RouteDiagram({ day }: { day: DaySchedule }) {
  const stops = day.items.filter(
    (i) => i.location && i.location.lat !== 0 && i.location.lng !== 0 && i.type !== 'transport'
  )
  if (stops.length === 0) return null

  return (
    // 예전엔 flex-wrap + 항목 사이 화살표였는데, 줄바꿈이 일어나면 줄 끝에 갈 곳 없는 화살표가
    // 매달리고 다음 줄 첫 항목에는 들어오는 화살표가 없었다. "이 셀이 줄의 마지막인가"는 CSS로
    // 알 수 없으므로(:nth-child는 줄을 인식하지 못한다) 화살표를 없앤다 — 순서는 이미 마커 안의
    // 번호가 말해주므로 중복 정보였다. grid로 바꾸면 셀 폭도 저절로 정렬된다.
    <div className="mb-3 grid grid-cols-[repeat(auto-fill,4.25rem)] gap-y-3">
      {stops.map((item, idx) => {
        const color = ITEM_TYPE_COLORS[item.type]
        return (
          <div key={item.id} className="flex flex-col items-center">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
              style={{ backgroundColor: color }}
            >
              {idx + 1}
            </div>
            <p className="text-center text-[0.6rem] text-gray-600 mt-1 leading-tight px-1 break-words w-full">
              {item.location!.name}
            </p>
            {/* 셀이 좁아 범위는 안 들어간다 — 동선의 관심사는 순서와 도착 시각이라 시작만 */}
            {item.startTime && (
              <p className="text-[0.6rem] text-gray-500 tabular-nums">{item.startTime}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── 일정 항목 행 ── */
function ScheduleItemRow({ item, localCurrency, showNotes = true }: { item: ScheduleItem; localCurrency?: string; showNotes?: boolean }) {
  const color = ITEM_TYPE_COLORS[item.type]
  // 마커 번호 표시용 — 부모에서 index 넘겨받으면 더 정확하지만 여기선 위치 여부만 활용
  const timeRange = formatTimeRange(item.startTime, item.endTime)
  return (
    // 한 줄이 페이지 경계에서 반으로 갈리는 걸 막는다 (한 페이지보다 작으므로 avoid가 유효)
    <div className="print-avoid-break flex items-start gap-2 py-[3px]">
      {/* 색상 바 */}
      <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
      {/* 시간을 grid 트랙으로 잡으면 본문 들여쓰기가 구조적으로 따라온다 — 예전엔 시간 span의 w-9와
          아래 본문의 ml-[calc(2.25rem+...)]이 하드코딩으로 묶여 있어서, 시간 표기가 "10:00"에서
          "10:00 ~ 11:30"으로 길어지면 정렬이 깨졌다. 시간이 없는 항목도 열이 유지돼 정렬이 맞는다. */}
      {/* 5rem은 "10:00 ~ 11:30"의 실측 폭(78px, 10px tabular-nums + Clock 아이콘) 기준 */}
      <div className="flex-1 min-w-0 grid grid-cols-[5rem_1fr] gap-x-1.5">
        <span className="text-[0.65rem] text-gray-600 tabular-nums whitespace-nowrap flex items-center gap-0.5">
          {timeRange && (
            <>
              <Clock className="h-2 w-2 shrink-0" />{timeRange}
            </>
          )}
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className="text-[0.65rem] px-1 py-px rounded border font-medium shrink-0"
              style={{ color, borderColor: color }}
            >
              {ITEM_TYPE_LABELS[item.type]}
            </span>
            <span className="text-[0.7rem] font-medium">{item.title}</span>
            {item.mealType && (
              <span className="text-[0.6rem] text-gray-600 shrink-0">{MEAL_TYPE_LABELS[item.mealType]}</span>
            )}
            {item.checkType && (
              <span className="text-[0.6rem] text-gray-600 shrink-0">{CHECK_TYPE_LABELS[item.checkType]}</span>
            )}
            {/* 인쇄된 일정표에서 가장 실질적인 정보 중 하나 */}
            {item.reservationNeeded && (
              <span className="text-[0.6rem] px-1 py-px rounded border border-amber-600 text-amber-700 shrink-0">
                예약 필요
              </span>
            )}
            {item.price != null && (
              <span className="ml-auto text-[0.65rem] text-gray-600 shrink-0 whitespace-nowrap">
                {item.price.toLocaleString()} {item.currency ?? localCurrency ?? ''}
              </span>
            )}
          </div>
          {(item.location?.name || item.location?.address || (showNotes && item.notes)) && (
            <div className="text-[0.65rem] text-gray-600 space-y-px mt-px">
              {item.location?.name && (
                <p className="flex items-center gap-0.5">
                  <MapPin className="h-2 w-2 shrink-0" />
                  {/* 이동 항목은 도착지만 보여주면 어디서 출발하는지 알 수 없다 */}
                  {item.fromLocation?.name ? `${item.fromLocation.name} → ${item.location.name}` : item.location.name}
                  {item.transportMode && (
                    <span className="text-gray-500">({TRANSPORT_LABELS[item.transportMode]})</span>
                  )}
                </p>
              )}
              {/* 종이에서는 지도 링크를 누를 수 없으니 주소가 곧 정보다 */}
              {item.location?.address && (
                <p className="pl-2.5 text-gray-500">{item.location.address}</p>
              )}
              {/* line-clamp를 걸면 화면과 달리 PDF에서는 영구히 잘린다. 줄바꿈도 그대로 살린다 */}
              {showNotes && item.notes && <p className="whitespace-pre-wrap break-words">{item.notes}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 메인 ── */
function PrintPageInner({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hydrated = useTripStore((s) => s.hydrated)
  const hydrate = useTripStore((s) => s.hydrate)
  // 셀렉터로 좁힌다 — useTripStore()를 통째로 구독하면 store의 어떤 변경에도 trip identity가
  // 바뀌어, 경로 조회 effect가 무한히 재실행되며 조용히 과금된다.
  const trip = useTripStore((s) => s.trips.find((t) => t.id === id))

  const opts = useMemo(() => parsePrintOptions(searchParams), [searchParams])
  const { legs, loading: routesLoading } = useDayRoutes(trip?.days ?? [], opts.map && !!trip)

  const printedRef = useRef(false) // StrictMode의 effect 2회 실행에 state는 늦다

  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])
  useEffect(() => { if (hydrated && !trip) router.push('/') }, [hydrated, trip, router])

  // 타이머가 아니라 게이트 — 데이터·경로·이미지가 모두 확정된 뒤에만 인쇄한다
  useEffect(() => {
    if (!trip || routesLoading || printedRef.current || !opts.auto) return
    const nights = trip.days.length - 1
    let cancelled = false
    waitForAssets().then(() => {
      // 센티널은 여기서 세운다. 진입 시점에 미리 세우면 StrictMode가 effect를 두 번 돌릴 때
      // 1차 실행이 cleanup으로 취소된 뒤 2차 실행이 "이미 인쇄함"으로 판단해 조기 반환하고,
      // 결국 아무도 인쇄하지 않는다(실제로 겪었다).
      if (cancelled || printedRef.current) return
      printedRef.current = true
      // Chrome은 이 값을 PDF 기본 파일명으로 쓴다
      document.title = `${sanitizeFilename(trip.title)}_${trip.startDate}_${nights}박${trip.days.length}일`
      window.print()
    })
    return () => { cancelled = true }
  }, [trip, routesLoading, opts.auto])

  if (!hydrated || !trip) {
    return (
      <div className="print-hide flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />일정을 불러오는 중…
      </div>
    )
  }

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
        {/* 인쇄 시 패딩을 0으로 — 여백은 @page가 소유한다(겹치면 본문 폭만 좁아진다) */}
        <div className="px-12 py-10 print:px-0 print:py-0 space-y-7">

          {/* ── 제목 헤더 ── */}
          <header className="print-avoid-break border-b-2 border-gray-900 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight leading-none">{trip.title}</h1>
                <p className="text-gray-600 mt-2 text-sm flex items-center gap-1">
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
            {/* isInternational로 가리지 않는다 — 국내여행에도 항공(제주)·숙박은 있고, 예산 합계에는
                포함되면서 표시만 안 되면 "보이지 않는 비용"이 생긴다. 이 플래그는 뱃지만 제어해야 한다. */}
            {opts.travel && ((trip.flights ?? []).length > 0 || (trip.accommodations ?? []).length > 0) && (
              <div className="mt-4 space-y-1.5">
                {(trip.flights ?? []).map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-[0.7rem] bg-indigo-50 rounded px-3 py-1.5">
                    <span className="font-semibold text-indigo-700 w-6 shrink-0">
                      {f.direction === 'outbound' ? '↗' : '↙'}
                    </span>
                    <span className="font-semibold text-gray-700">{f.airline} {f.flightNumber}</span>
                    <span className="text-gray-500 mx-1">|</span>
                    <span className="text-gray-600">
                      {f.departureAirport} <strong>{f.departureTime}</strong>
                      {' → '}
                      {f.arrivalAirport} <strong>{f.arrivalTime}</strong>
                      {/* 야간 비행은 도착 날짜가 없으면 언제 내리는지 모호하다 */}
                      {f.arrivalDate && f.arrivalDate !== f.departureDate && (
                        <span className="text-gray-500"> ({f.arrivalDate.slice(5)} 도착)</span>
                      )}
                    </span>
                    <span className="text-gray-600">{f.departureDate}</span>
                    {f.seat && <span className="text-gray-600">{f.seat}</span>}
                    {f.bookingRef && (
                      <>
                        <span className="text-gray-500">|</span>
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
                  <div key={a.id} className="flex items-center gap-2 text-[0.7rem] bg-violet-50 rounded px-3 py-1.5 flex-wrap">
                    <span className="font-semibold text-violet-700 w-6 shrink-0">🏨</span>
                    <span className="font-semibold text-gray-700">{a.name}</span>
                    {a.address && <span className="text-gray-600">{a.address}</span>}
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-600">
                      체크인 <strong>{a.checkInDate?.slice(5)}</strong>{a.checkInTime && ` ${a.checkInTime}`}
                      {' ~ '}
                      체크아웃 <strong>{a.checkOutDate?.slice(5)}</strong>{a.checkOutTime && ` ${a.checkOutTime}`}
                    </span>
                    {(a.bookingPlatform || a.bookingRef) && (
                      <>
                        <span className="text-gray-500">|</span>
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
                        <span className="text-gray-500">|</span>
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
            // 하루 전체에는 avoid를 걸지 않는다 — 페이지보다 길면 무시되면서 앞 페이지에
            // 큰 여백만 남긴다. 대신 제목 행과 일정 한 줄 단위로 avoid를 건다.
            <section
              key={day.date}
              // 첫 날은 헤더 바로 뒤에 이어지게 둔다. :first-of-type을 쓰지 않는 이유는 예산 섹션도
              // <section>이라 마크업이 바뀌면 조용히 깨지기 때문이다.
              className={`space-y-2 ${opts.perDayPage && idx > 0 ? 'print-break-before' : ''}`}
            >
              {/* 날짜 제목 — 제목만 페이지 하단에 홀로 남지 않게 */}
              <div className="print-avoid-break print-break-after-avoid flex items-center gap-2.5 border-b pb-1.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0">
                  {idx + 1}
                </span>
                <h2 className="text-base font-bold">{getDayLabel(idx)}</h2>
                <span className="text-sm text-gray-600 font-normal">{formatDate(day.date)}</span>
                <span className="ml-auto text-xs text-gray-600">{day.items.length}개 일정</span>
              </div>

              {day.items.length === 0 ? (
                <p className="text-xs text-gray-600 italic pl-8">일정 없음</p>
              ) : (
                <>
                  {/* 지도가 꺼져 있으면 컴포넌트를 아예 렌더하지 않는다 — display:none으로 숨기면
                      요청은 그대로 나가서 과금된다 */}
                  {opts.map ? (
                    <DayRouteMap
                      day={day}
                      legs={legs}
                      tall={opts.perDayPage}
                      fallback={<RouteDiagram day={day} />}
                    />
                  ) : (
                    <RouteDiagram day={day} />
                  )}
                  {/* 일정 목록 */}
                  <div className="space-y-0.5 pl-1 border-l-2 border-gray-100 ml-1">
                    {day.items.map((item) => (
                      <ScheduleItemRow
                        key={item.id}
                        item={item}
                        localCurrency={trip.budget?.localCurrency}
                        showNotes={opts.notes}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          ))}

          {/* ── 예산 요약 ── */}
          {opts.budget && hasBudget && (
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
                          <td className="py-[3px] text-right">{actual ? `₩${actual.toLocaleString()}` : <span className="text-gray-500">-</span>}</td>
                          <td className={`py-[3px] text-right font-semibold ${over ? 'text-red-500' : actual ? 'text-emerald-600' : 'text-gray-500'}`}>
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
                    <p className="text-[0.65rem] text-gray-600">
                      1 {trip.budget.localCurrency} = ₩{trip.budget.exchangeRate}
                    </p>
                  )}
                  <div className={`rounded px-3 py-2 text-right ${totalActual <= totalPlanned ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className="text-[0.65rem] text-gray-500">예산 대비</p>
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
          <footer className="border-t pt-3 text-center text-[0.65rem] text-gray-500 print-avoid-break">
            여행 플래너 · {new Date().toLocaleDateString('ko-KR')} 출력
          </footer>
        </div>
      </div>
    </div>
  )
}

// useSearchParams를 쓰는 컴포넌트는 Suspense 경계가 필요하다 (Next.js app router)
export default function PrintPage({ params }: PageProps) {
  const { id } = use(params)
  return (
    <Suspense fallback={null}>
      <PrintPageInner id={id} />
    </Suspense>
  )
}
