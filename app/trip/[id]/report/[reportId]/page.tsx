'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import { getSignedUrls } from '@/lib/reportStorage'
import { formatDate, getDayLabel } from '@/lib/utils'
import { ReportPhotoMeta, TravelReport } from '@/lib/types'
import {
  ArrowLeft, Sparkles, Loader2, FileText, Camera, BookOpen, Printer, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PageProps {
  params: Promise<{ id: string; reportId: string }>
}

export default function ReportDetailPage({ params }: PageProps) {
  const { id: tripId, reportId } = use(params)
  const router = useRouter()
  const { hydrated, hydrate, getTrip, userId, updateReport, deleteReport } = useTripStore()

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [photoMeta, setPhotoMeta] = useState<ReportPhotoMeta[]>([])
  const [step, setStep] = useState<2 | 3>(2)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])

  const trip = getTrip(tripId)
  const report = trip?.reports?.find((r: TravelReport) => r.id === reportId)

  useEffect(() => {
    if (hydrated && (!trip || !report)) router.push(`/trip/${tripId}`)
  }, [hydrated, trip, report, router, tripId])

  // photoMeta 초기화
  useEffect(() => {
    if (report?.photoMeta) setPhotoMeta(report.photoMeta)
  }, [report?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // draft 상태면 signed URL 로드
  useEffect(() => {
    if (!report || report.status !== 'draft' || report.photoMeta.length === 0) return
    setLoadingUrls(true)
    const paths = report.photoMeta.map((p) => p.storagePath)
    getSignedUrls(paths)
      .then(setSignedUrls)
      .catch(console.error)
      .finally(() => setLoadingUrls(false))
  }, [report?.id, report?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated || !trip || !report) return null

  // ── 완료된 보고서 보기 ──
  if (report.status === 'completed') {
    return <CompletedView report={report} trip={trip} onBack={() => router.push(`/trip/${tripId}`)} onDelete={() => {
      if (!confirm('이 후기를 삭제할까요?')) return
      deleteReport(tripId, reportId)
      router.push(`/trip/${tripId}`)
    }} />
  }

  // ── Step 2: 코멘트 작성 ──
  const handleSaveComments = () => {
    updateReport(tripId, reportId, { photoMeta })
  }

  const handlePhotoChange = (id: string, field: keyof ReportPhotoMeta, value: string | number) => {
    setPhotoMeta((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  // ── Step 3: AI 생성 ──
  const handleGenerate = async () => {
    handleSaveComments()
    setIsGenerating(true)
    setGenerateError('')

    const dayContexts = trip.days
      .map((day, idx) => {
        const photosForDay = photoMeta.filter((p) => p.dayIndex === idx)
        return {
          dayIndex: idx,
          dateLabel: formatDate(day.date),
          scheduleItems: day.items.map((i) => i.title),
          photoComments: photosForDay.map((p) => p.comment).filter(Boolean),
        }
      })
      .filter((d) => d.photoComments.length > 0 || d.scheduleItems.length > 0)

    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripTitle: trip.title,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          dayContexts,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '생성 실패')

      const scheduleSummary = trip.days
        .map((day, idx) => `${getDayLabel(idx)} (${formatDate(day.date)}): ${day.items.map((i) => i.title).join(', ') || '일정 없음'}`)
        .join('\n')

      updateReport(tripId, reportId, {
        aiDayTexts: data.dayTexts ?? {},
        aiGeneratedText: data.overallReview ?? '',
        scheduleSummary,
        photoMeta,
      })
      setStep(3)
    } catch (err) {
      setGenerateError(String(err))
    } finally {
      setIsGenerating(false)
    }
  }

  // 날짜별 그룹
  const photosByDay = trip.days.map((day, idx) => ({
    dayIdx: idx,
    dateLabel: formatDate(day.date),
    photos: photoMeta.filter((p) => p.dayIndex === idx).sort((a, b) => a.order - b.order),
  }))
  const unassigned = photoMeta.filter((p) => !trip.days[p.dayIndex])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-2.5 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />돌아가기
        </Button>
        <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{report.title}</span>
        {step === 2 && (
          <Button size="sm" variant="outline" onClick={handleSaveComments}>저장</Button>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* 단계 표시 */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">1 업로드 ✓</span>
          <span className="text-gray-300 mx-1">›</span>
          <span className={`rounded-full w-5 h-5 flex items-center justify-center font-bold ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white'}`}>
            {step === 2 ? '2' : '✓'}
          </span>
          <span className={`font-medium ${step === 2 ? '' : 'text-gray-400'}`}>코멘트 작성</span>
          <span className="text-gray-300 mx-1">›</span>
          <span className={`rounded-full w-5 h-5 flex items-center justify-center font-bold ${step === 3 ? 'bg-primary text-primary-foreground' : 'text-gray-400 border border-gray-300'}`}>3</span>
          <span className={`${step === 3 ? 'font-medium' : 'text-gray-400'}`}>AI + PDF</span>
        </div>

        {/* ── STEP 2: 코멘트 작성 ── */}
        {step === 2 && (
          <>
            {loadingUrls ? (
              <div className="text-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                <p className="text-sm text-gray-400 mt-2">사진 불러오는 중...</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  각 사진의 날짜를 지정하고 코멘트를 남겨주세요. AI가 이를 바탕으로 여행 후기를 작성합니다.
                </p>

                {/* 날짜별 섹션 */}
                {photosByDay.map(({ dayIdx, dateLabel, photos: dayPhotos }) => (
                  dayPhotos.length === 0 ? null : (
                    <section key={dayIdx} className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] flex items-center justify-center font-bold">{dayIdx + 1}</span>
                        {getDayLabel(dayIdx)} · {dateLabel}
                      </h3>
                      <div className="space-y-3">
                        {dayPhotos.map((photo) => (
                          <PhotoCommentCard
                            key={photo.id}
                            photo={photo}
                            signedUrl={signedUrls[photo.storagePath]}
                            days={trip.days}
                            onChange={handlePhotoChange}
                          />
                        ))}
                      </div>
                    </section>
                  )
                ))}

                {/* 미배치 사진 */}
                {unassigned.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-amber-600">날짜 미지정 사진</h3>
                    {unassigned.map((photo) => (
                      <PhotoCommentCard
                        key={photo.id}
                        photo={photo}
                        signedUrl={signedUrls[photo.storagePath]}
                        days={trip.days}
                        onChange={handlePhotoChange}
                      />
                    ))}
                  </section>
                )}

                {generateError && (
                  <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{generateError}</p>
                )}

                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />AI 텍스트 생성 중...</>
                    : <><Sparkles className="h-4 w-4 mr-1.5" />AI 텍스트 생성 + PDF 만들기</>
                  }
                </Button>
              </>
            )}
          </>
        )}

        {/* ── STEP 3: AI 결과 + PDF ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-medium">
              AI 텍스트 생성 완료! PDF를 미리보고 다운로드하세요.
            </div>

            {/* 날짜별 AI 텍스트 미리보기 */}
            {Object.entries(report.aiDayTexts ?? {}).map(([dayIdx, text]) => {
              const day = trip.days[Number(dayIdx)]
              return day ? (
                <div key={dayIdx} className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {getDayLabel(Number(dayIdx))} · {formatDate(day.date)}
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed bg-white border rounded-lg px-3 py-2">{text}</p>
                </div>
              ) : null
            })}

            {report.aiGeneratedText && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">전체 총평</h3>
                <p className="text-sm text-gray-700 leading-relaxed bg-white border rounded-lg px-3 py-2 whitespace-pre-wrap">
                  {report.aiGeneratedText}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                ← 코멘트 수정
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push(`/trip/${tripId}/report/${reportId}/print`)}
              >
                <Printer className="h-4 w-4 mr-1.5" />PDF 보기 / 다운로드
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              PDF 저장 후 &ldquo;완료하기&rdquo; 버튼을 누르면 사진이 삭제되고 보고서가 완료됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 사진 코멘트 카드 ──
function PhotoCommentCard({
  photo, signedUrl, days, onChange,
}: {
  photo: ReportPhotoMeta
  signedUrl?: string
  days: { date: string }[]
  onChange: (id: string, field: keyof ReportPhotoMeta, value: string | number) => void
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      <div className="flex gap-3 p-3">
        {/* 썸네일 */}
        <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
          {signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signedUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="h-6 w-6 text-gray-300" />
            </div>
          )}
        </div>
        {/* 입력 */}
        <div className="flex-1 space-y-2">
          <Select
            value={String(photo.dayIndex)}
            onValueChange={(v) => onChange(photo.id, 'dayIndex', Number(v))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {days.map((_, idx) => (
                <SelectItem key={idx} value={String(idx)} className="text-xs">
                  {getDayLabel(idx)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="이 사진에 대한 코멘트..."
            value={photo.comment}
            onChange={(e) => onChange(photo.id, 'comment', e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      </div>
    </div>
  )
}

// ── 완료된 보고서 뷰 ──
function CompletedView({
  report, trip, onBack, onDelete,
}: {
  report: TravelReport
  trip: { title: string; destination: string; startDate: string; endDate: string; days: { date: string; items: { title: string }[] }[] }
  onBack: () => void
  onDelete: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-2.5 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />돌아가기
        </Button>
        <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{report.title}</span>
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-400 hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          완료된 후기 · {new Date(report.createdAt).toLocaleDateString('ko-KR')}
          · 사진 {report.photoMeta.length}장 (삭제됨)
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
          사진은 PDF 생성 완료 후 삭제되었습니다. 코멘트와 AI 텍스트는 보관됩니다.
        </div>

        {/* 날짜별 코멘트 + AI 텍스트 */}
        {trip.days.map((day, idx) => {
          const photos = report.photoMeta.filter((p) => p.dayIndex === idx)
          const aiText = report.aiDayTexts?.[String(idx)]
          if (photos.length === 0 && !aiText) return null
          return (
            <section key={idx} className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-gray-800 text-white text-[10px] flex items-center justify-center">{idx + 1}</span>
                {getDayLabel(idx)} · {formatDate(day.date)}
              </h3>
              {photos.length > 0 && (
                <div className="space-y-1 pl-2">
                  {photos.map((p) => p.comment && (
                    <p key={p.id} className="text-xs text-gray-600 bg-white border rounded px-2 py-1">
                      <FileText className="h-3 w-3 inline mr-1 text-gray-400" />{p.comment}
                    </p>
                  ))}
                </div>
              )}
              {aiText && (
                <p className="text-sm text-gray-700 leading-relaxed bg-white border rounded-lg px-3 py-2">{aiText}</p>
              )}
            </section>
          )
        })}

        {report.aiGeneratedText && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">전체 여행 총평</h3>
            <p className="text-sm text-gray-700 leading-relaxed bg-white border rounded-lg px-3 py-2 whitespace-pre-wrap">
              {report.aiGeneratedText}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
