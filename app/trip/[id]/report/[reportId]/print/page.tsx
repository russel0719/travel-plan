'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import { getSignedUrls, deleteReportPhotos } from '@/lib/reportStorage'
import { formatDate, getDayLabel } from '@/lib/utils'
import { TravelReport } from '@/lib/types'
import { ArrowLeft, Printer, CheckCircle2, Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ id: string; reportId: string }>
}

export default function ReportPrintPage({ params }: PageProps) {
  const { id: tripId, reportId } = use(params)
  const router = useRouter()
  const { hydrated, hydrate, getTrip, userId, updateReport } = useTripStore()

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])

  const trip = getTrip(tripId)
  const report = trip?.reports?.find((r: TravelReport) => r.id === reportId)

  useEffect(() => {
    if (hydrated && (!trip || !report)) router.push(`/trip/${tripId}`)
  }, [hydrated, trip, report, router, tripId])

  useEffect(() => {
    if (!report || report.photoMeta.length === 0) {
      setLoadingUrls(false)
      return
    }
    const paths = report.photoMeta.map((p) => p.storagePath)
    getSignedUrls(paths)
      .then(setSignedUrls)
      .catch(console.error)
      .finally(() => setLoadingUrls(false))
  }, [report?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated || !trip || !report) return null

  const nights = trip.days.length - 1

  // 날짜별 사진 그룹
  const photosByDay = trip.days
    .map((day, idx) => ({
      dayIdx: idx,
      day,
      photos: report.photoMeta
        .filter((p) => p.dayIndex === idx)
        .sort((a, b) => a.order - b.order),
      aiText: report.aiDayTexts?.[String(idx)] ?? '',
    }))
    .filter((d) => d.photos.length > 0 || d.aiText)

  const handleComplete = async () => {
    if (!confirm('PDF를 저장하셨나요? 완료하면 사진이 삭제됩니다.')) return
    setIsCompleting(true)
    const paths = report.photoMeta.map((p) => p.storagePath)
    await deleteReportPhotos(paths)
    updateReport(tripId, reportId, { status: 'completed' })
    router.push(`/trip/${tripId}/report/${reportId}`)
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">

      {/* 화면 전용 컨트롤 */}
      <div className="print-hide sticky top-0 z-10 bg-white border-b px-4 py-2.5 flex items-center justify-between shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />돌아가기
        </Button>
        <span className="text-sm font-medium text-gray-600">PDF 미리보기</span>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" />인쇄 / PDF 저장
          </Button>
          {report.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-300 hover:bg-green-50"
              onClick={handleComplete}
              disabled={isCompleting}
            >
              {isCompleting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><CheckCircle2 className="h-4 w-4 mr-1" />완료하기</>
              }
            </Button>
          )}
        </div>
      </div>

      {loadingUrls ? (
        <div className="flex items-center justify-center py-24 print:hidden">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-400">사진 불러오는 중...</span>
        </div>
      ) : (
        <div className="max-w-[210mm] mx-auto bg-white print:max-w-none print:mx-0 my-8 print:my-0 shadow-xl print:shadow-none">
          <div className="px-12 py-10 print:px-10 print:py-8">

            {/* ── 표지 ── */}
            <header className="print-avoid-break border-b-2 border-gray-900 pb-8 mb-8">
              <h1 className="text-4xl font-bold tracking-tight leading-tight">{report.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />{trip.destination}
                </span>
                <span>{formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}</span>
                <span>{nights}박 {trip.days.length}일</span>
                <span>사진 {report.photoMeta.length}장</span>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {new Date(report.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 작성
              </p>
            </header>

            {/* ── 날짜별 섹션 ── */}
            {photosByDay.map(({ dayIdx, day, photos, aiText }) => {
              // 2장씩 묶기
              const pairs: typeof photos[] = []
              for (let i = 0; i < photos.length; i += 2) {
                pairs.push(photos.slice(i, i + 2))
              }

              return (
                <section key={dayIdx} className="mb-10 print-avoid-break">
                  {/* 날짜 헤더 */}
                  <div className="flex items-center gap-3 mb-5 pb-2 border-b border-gray-200">
                    <span className="w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center shrink-0">
                      {dayIdx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-lg">{getDayLabel(dayIdx)}</span>
                      <span className="text-gray-400 text-sm ml-2">{formatDate(day.date)}</span>
                    </div>
                  </div>

                  {/* 사진 2장 + AI 텍스트 번갈아 */}
                  {pairs.map((pair, pairIdx) => (
                    <div key={pairIdx} className="mb-6">
                      {/* 사진 그리드 */}
                      <div className={`grid gap-3 mb-4 ${pair.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
                        {pair.map((photo) => (
                          <div key={photo.id} className="space-y-1.5">
                            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-gray-100">
                              {signedUrls[photo.storagePath] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={signedUrls[photo.storagePath]}
                                  alt={photo.comment || ''}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                                  사진 없음
                                </div>
                              )}
                            </div>
                            {photo.comment && (
                              <p className="text-xs text-gray-500 leading-relaxed italic px-0.5">
                                {photo.comment}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 쌍마다 AI 텍스트 표시 (첫 번째 쌍에만 표시) */}
                      {pairIdx === 0 && aiText && (
                        <p className="text-sm text-gray-700 leading-relaxed border-l-2 border-gray-200 pl-3">
                          {aiText}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              )
            })}

            {/* ── 전체 총평 ── */}
            {report.aiGeneratedText && (
              <section className="print-avoid-break mt-8 pt-8 border-t">
                <h2 className="text-xl font-bold mb-5">여행을 마치며</h2>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {report.aiGeneratedText}
                </p>
              </section>
            )}

            {/* ── 일정 요약 ── */}
            {report.scheduleSummary && (
              <section className="print-avoid-break mt-8 pt-6 border-t">
                <h2 className="text-base font-bold mb-3 text-gray-500">일정 요약</h2>
                <pre className="text-xs text-gray-500 whitespace-pre-wrap font-sans leading-relaxed">
                  {report.scheduleSummary}
                </pre>
              </section>
            )}

            {/* 푸터 */}
            <footer className="mt-10 pt-4 border-t text-center text-[10px] text-gray-300 print-avoid-break">
              여행 플래너 · {new Date().toLocaleDateString('ko-KR')} 출력
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
