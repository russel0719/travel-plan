'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import { Trip } from '@/lib/types'
import { formatDate, getDayLabel } from '@/lib/utils'
import { ArrowLeft, Sparkles, Save, Printer, ImagePlus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PageProps {
  params: Promise<{ id: string }>
}

function buildScheduleSummary(trip: Trip): string {
  return trip.days
    .map((day, idx) => {
      const items = day.items.map((i) => i.title).join(', ')
      return `${getDayLabel(idx)} (${formatDate(day.date)}): ${items || '일정 없음'}`
    })
    .join('\n')
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-base font-bold mt-4 mb-1 first:mt-0">{line.slice(3)}</h2>
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

export default function ReportPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { hydrated, hydrate, getTrip, addReport } = useTripStore()

  const [title, setTitle] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [userNotes, setUserNotes] = useState('')
  const [aiText, setAiText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])

  const trip = getTrip(id)

  useEffect(() => {
    if (hydrated && !trip) router.push('/')
  }, [hydrated, trip, router])

  useEffect(() => {
    if (trip && !title) setTitle(`${trip.title} 여행 후기`)
  }, [trip, title])

  useEffect(() => {
    return () => { photoUrls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [photoUrls])

  if (!hydrated || !trip) return null

  const scheduleSummary = buildScheduleSummary(trip)

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setPhotos((prev) => [...prev, ...files])
    setPhotoUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const handlePhotoRemove = (idx: number) => {
    URL.revokeObjectURL(photoUrls[idx])
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripTitle: trip.title,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          scheduleSummary,
          userNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '생성 실패')
      setAiText(data.aiText)
    } catch (err) {
      setGenerateError(String(err))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    const report = addReport(id, {
      title,
      userNotes,
      aiGeneratedText: aiText,
      scheduleSummary,
      photoCount: photos.length,
    })

    // 사진을 sessionStorage에 임시 저장 (PDF용)
    if (photos.length > 0) {
      try {
        const base64s = await Promise.all(
          photos.map(
            (f) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(f)
              })
          )
        )
        sessionStorage.setItem(`report-photos-${report.id}`, JSON.stringify(base64s))
      } catch {
        // 저장 실패 시 사진 없이 저장
      }
    }

    setIsSaving(false)
    router.push(`/trip/${id}/report/${report.id}`)
  }

  const nights = trip.days.length - 1

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* 컨트롤 바 */}
      <div className="print-hide sticky top-0 z-10 bg-white border-b px-4 py-2.5 flex items-center justify-between shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />돌아가기
        </Button>
        <h1 className="text-sm font-semibold text-gray-700">새 여행 후기 작성</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!aiText && !userNotes}>
            <Printer className="h-4 w-4 mr-1.5" />PDF 저장
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || (!aiText && !userNotes)}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            저장
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 print:px-10 print:py-8 print:max-w-none">

        {/* 인쇄용 헤더 */}
        <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-6">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {trip.destination} · {formatDate(trip.startDate)} ~ {formatDate(trip.endDate)} ({nights}박 {trip.days.length}일)
          </p>
        </div>

        {/* 제목 */}
        <div className="print-hide space-y-1.5">
          <Label htmlFor="report-title">보고서 제목</Label>
          <Input
            id="report-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base font-medium"
          />
        </div>

        {/* 사진 업로드 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between print-hide">
            <h2 className="text-sm font-semibold text-gray-700">사진</h2>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-1.5" />사진 추가
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoAdd}
            />
          </div>

          {photoUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 print:grid-cols-4 print:gap-3">
              {photoUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-square group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`사진 ${idx + 1}`}
                    className="w-full h-full object-cover rounded-md"
                  />
                  <button
                    onClick={() => handlePhotoRemove(idx)}
                    className="print-hide absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="print-hide border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-gray-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">클릭하거나 사진을 끌어다 놓으세요</p>
            </div>
          )}
        </section>

        {/* 나의 메모 */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 print-hide">나의 메모</h2>
          <div className="print-hide">
            <Textarea
              placeholder="여행 중 느꼈던 감정, 특별한 경험, 기억에 남는 순간을 자유롭게 적어주세요..."
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>
          {userNotes && (
            <div className="hidden print:block">
              <h2 className="text-base font-bold mb-2">나의 메모</h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700">{userNotes}</p>
            </div>
          )}
        </section>

        {/* AI 후기 생성 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between print-hide">
            <h2 className="text-sm font-semibold text-gray-700">AI 여행 후기</h2>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isGenerating
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />생성 중...</>
                : <><Sparkles className="h-4 w-4 mr-1.5" />AI 후기 생성</>
              }
            </Button>
          </div>

          {generateError && (
            <p className="print-hide text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{generateError}</p>
          )}

          {aiText ? (
            <>
              <Textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={16}
                className="print-hide font-mono text-xs resize-none"
              />
              <div className="hidden print:block">
                <h2 className="text-base font-bold mb-3">AI 여행 후기</h2>
                <MarkdownBlock text={aiText} />
              </div>
            </>
          ) : (
            <div className="print-hide bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center">
              <Sparkles className="h-7 w-7 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">
                여행 일정과 메모를 바탕으로 AI가 후기를 작성합니다
              </p>
            </div>
          )}
        </section>

        {/* 일정 요약 (인쇄용) */}
        <section className="hidden print:block print-avoid-break">
          <h2 className="text-base font-bold mb-3 border-t pt-4">일정 요약</h2>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-sans">{scheduleSummary}</pre>
        </section>

        {/* 인쇄 푸터 */}
        <footer className="hidden print:block border-t pt-3 text-center text-[10px] text-gray-300 print-avoid-break">
          여행 플래너 · {new Date().toLocaleDateString('ko-KR')} 출력
        </footer>
      </div>
    </div>
  )
}
