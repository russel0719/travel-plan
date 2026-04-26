'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import { TravelReport } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Printer, Trash2, ImagePlus, Calendar, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ id: string; reportId: string }>
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-base font-bold mt-5 mb-1 first:mt-0">{line.slice(3)}</h2>
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-sm font-semibold mt-3 mb-0.5">{line.slice(4)}</h3>
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4 list-disc">{renderInline(line.slice(2))}</li>
        }
        if (line.trim() === '') return <div key={i} className="h-2" />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  )
}

export default function ReportViewPage({ params }: PageProps) {
  const { id, reportId } = use(params)
  const router = useRouter()
  const { hydrated, hydrate, getTrip, deleteReport } = useTripStore()
  const [photoUrls, setPhotoUrls] = useState<string[]>([])

  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])

  const trip = getTrip(id)
  const report = trip?.reports?.find((r: TravelReport) => r.id === reportId)

  useEffect(() => {
    if (hydrated && (!trip || !report)) router.push(`/trip/${id}`)
  }, [hydrated, trip, report, router, id])

  // sessionStorage에서 임시 사진 로드
  useEffect(() => {
    if (!reportId) return
    try {
      const stored = sessionStorage.getItem(`report-photos-${reportId}`)
      if (stored) {
        setPhotoUrls(JSON.parse(stored))
      }
    } catch {
      // 무시
    }
  }, [reportId])

  if (!hydrated || !trip || !report) return null

  const handleDelete = () => {
    if (!confirm('이 후기를 삭제할까요?')) return
    sessionStorage.removeItem(`report-photos-${reportId}`)
    deleteReport(id, reportId)
    router.push(`/trip/${id}`)
  }

  const nights = trip.days.length - 1
  const createdDate = new Date(report.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* 컨트롤 바 */}
      <div className="print-hide sticky top-0 z-10 bg-white border-b px-4 py-2.5 flex items-center justify-between shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />돌아가기
        </Button>
        <h1 className="text-sm font-semibold text-gray-700 truncate max-w-[200px]">{report.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" />PDF 저장
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 print:px-10 print:py-8 print:max-w-none">

        {/* 헤더 */}
        <header className="border-b-2 border-gray-900 pb-5 print-avoid-break">
          <h1 className="text-2xl font-bold leading-tight">{report.title}</h1>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDate(trip.startDate)} ~ {formatDate(trip.endDate)} ({nights}박 {trip.days.length}일)
            </span>
            <span className="flex items-center gap-1.5">
              <ImagePlus className="h-4 w-4" />
              {trip.destination}
            </span>
            {report.photoCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Camera className="h-4 w-4" />
                사진 {report.photoCount}장
                {photoUrls.length === 0 && (
                  <span className="text-xs text-gray-400">(이 기기의 세션에서만 표시됨)</span>
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">작성일: {createdDate}</p>
        </header>

        {/* 사진 갤러리 */}
        {photoUrls.length > 0 && (
          <section className="space-y-2 print-avoid-break">
            <h2 className="text-base font-bold print:text-lg">사진</h2>
            <div className="grid grid-cols-3 gap-2 print:grid-cols-4 print:gap-3">
              {photoUrls.map((url, idx) => (
                <div key={idx} className="aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`사진 ${idx + 1}`}
                    className="w-full h-full object-cover rounded-md"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 나의 메모 */}
        {report.userNotes && (
          <section className="space-y-2 print-avoid-break">
            <h2 className="text-base font-bold">나의 메모</h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-4 print:bg-white print:border-gray-200">
              {report.userNotes}
            </p>
          </section>
        )}

        {/* AI 후기 */}
        {report.aiGeneratedText && (
          <section className="space-y-2">
            <h2 className="text-base font-bold">AI 여행 후기</h2>
            <div className="bg-white border border-gray-100 rounded-lg p-5 print:border-0 print:p-0">
              <MarkdownBlock text={report.aiGeneratedText} />
            </div>
          </section>
        )}

        {/* 일정 요약 */}
        {report.scheduleSummary && (
          <section className="print-avoid-break">
            <h2 className="text-base font-bold mb-3">일정 요약</h2>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-sans bg-gray-50 rounded-lg p-4 print:bg-white print:border print:border-gray-200 print:p-3">
              {report.scheduleSummary}
            </pre>
          </section>
        )}

        {/* 푸터 */}
        <footer className="hidden print:block border-t pt-3 text-center text-[10px] text-gray-300 print-avoid-break">
          여행 플래너 · {new Date().toLocaleDateString('ko-KR')} 출력
        </footer>
      </div>
    </div>
  )
}
