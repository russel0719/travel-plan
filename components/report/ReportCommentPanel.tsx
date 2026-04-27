'use client'

import { useEffect, useRef, useState } from 'react'
import { useTripStore } from '@/store/tripStore'
import { getSignedUrls, compressAndUpload } from '@/lib/reportStorage'
import { formatDate, getDayLabel, generateId } from '@/lib/utils'
import { ReportPhotoMeta, TravelReport } from '@/lib/types'
import {
  ArrowLeft, Loader2, Camera, Printer, ImagePlus, ChevronUp, ChevronDown,
  FileText, BookOpen, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

const MAX_TOTAL_PHOTOS = 50

interface ReportCommentPanelProps {
  tripId: string
  reportId: string
  onPrint: () => void
  onBack: () => void
}

export default function ReportCommentPanel({ tripId, reportId, onPrint, onBack }: ReportCommentPanelProps) {
  const { getTrip, userId, updateReport, deleteReport } = useTripStore()
  const trip = getTrip(tripId)
  const report = trip?.reports?.find((r: TravelReport) => r.id === reportId)

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [photoMeta, setPhotoMeta] = useState<ReportPhotoMeta[]>([])
  const [isAddingPhotos, setIsAddingPhotos] = useState(false)
  const addPhotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (report?.photoMeta) setPhotoMeta(report.photoMeta)
  }, [report?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!report || report.photoMeta.length === 0) return
    setLoadingUrls(true)
    const paths = report.photoMeta.map((p) => p.storagePath)
    getSignedUrls(paths)
      .then(setSignedUrls)
      .catch(console.error)
      .finally(() => setLoadingUrls(false))
  }, [report?.id, report?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip || !report) return null

  // ── 완료된 후기 뷰 ──
  if (report.status === 'completed') {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b bg-white px-4 py-2.5 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />뒤로
          </Button>
          <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{report.title}</span>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-400 hover:text-red-500"
            onClick={() => {
              if (!confirm('이 후기를 삭제할까요?')) return
              deleteReport(tripId, reportId)
              onBack()
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              완료된 후기 · {new Date(report.createdAt).toLocaleDateString('ko-KR')}
              · 사진 {report.photoMeta.length}장 (삭제됨)
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
              사진은 PDF 생성 완료 후 삭제되었습니다. 코멘트는 보관됩니다.
            </div>
            {trip.days.map((day, idx) => {
              const photos = report.photoMeta.filter((p) => p.dayIndex === idx)
              if (photos.length === 0) return null
              return (
                <section key={idx} className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-gray-800 text-white text-[10px] flex items-center justify-center">{idx + 1}</span>
                    {getDayLabel(idx)} · {formatDate(day.date)}
                  </h3>
                  <div className="space-y-1 pl-2">
                    {photos.map((p) => p.comment && (
                      <p key={p.id} className="text-xs text-gray-600 bg-white border rounded px-2 py-1">
                        <FileText className="h-3 w-3 inline mr-1 text-gray-400" />{p.comment}
                      </p>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── 코멘트 작성 (draft) ──
  const handleSaveComments = () => {
    updateReport(tripId, reportId, { photoMeta })
  }

  const handlePhotoChange = (id: string, field: keyof ReportPhotoMeta, value: string | number) => {
    setPhotoMeta((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p))
  }

  const handleReorderPhoto = (photoId: string, direction: 'up' | 'down') => {
    const photo = photoMeta.find((p) => p.id === photoId)
    if (!photo) return
    const dayPhotos = photoMeta
      .filter((p) => p.dayIndex === photo.dayIndex)
      .sort((a, b) => a.order - b.order)
    const idx = dayPhotos.findIndex((p) => p.id === photoId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= dayPhotos.length) return
    const swapPhoto = dayPhotos[swapIdx]
    setPhotoMeta((prev) => prev.map((p) => {
      if (p.id === photoId) return { ...p, order: swapPhoto.order }
      if (p.id === swapPhoto.id) return { ...p, order: photo.order }
      return p
    }))
  }

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) return
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remaining = MAX_TOTAL_PHOTOS - photoMeta.length
    if (remaining <= 0) return
    const toAdd = files.slice(0, remaining)
    e.target.value = ''
    setIsAddingPhotos(true)
    const newPhotos: ReportPhotoMeta[] = []
    const maxOrder = photoMeta.length > 0 ? Math.max(...photoMeta.map((p) => p.order)) : -1
    for (let i = 0; i < toAdd.length; i++) {
      const photoId = generateId()
      const storagePath = `${userId}/${tripId}/${reportId}/${photoId}.jpg`
      try {
        await compressAndUpload(toAdd[i], storagePath)
        newPhotos.push({ id: photoId, storagePath, dayIndex: 0, order: maxOrder + 1 + i, comment: '' })
      } catch (err) {
        console.error('사진 업로드 실패:', err)
      }
    }
    if (newPhotos.length > 0) {
      const newUrls = await getSignedUrls(newPhotos.map((p) => p.storagePath)).catch(() => ({}))
      setSignedUrls((prev) => ({ ...prev, ...newUrls }))
      setPhotoMeta((prev) => [...prev, ...newPhotos])
    }
    setIsAddingPhotos(false)
  }

  const photosByDay = trip.days.map((day, idx) => ({
    dayIdx: idx,
    dateLabel: formatDate(day.date),
    photos: photoMeta.filter((p) => p.dayIndex === idx).sort((a, b) => a.order - b.order),
  }))
  const unassigned = photoMeta.filter((p) => !trip.days[p.dayIndex])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 패널 헤더 */}
      <div className="border-b bg-white px-4 py-2.5 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />뒤로
        </Button>
        <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{report.title}</span>
        {photoMeta.length < MAX_TOTAL_PHOTOS && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => addPhotoInputRef.current?.click()}
            disabled={isAddingPhotos}
          >
            {isAddingPhotos
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><ImagePlus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">사진 추가</span></>
            }
          </Button>
        )}
        <input
          ref={addPhotoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleAddPhotos}
        />
        <Button size="sm" variant="outline" onClick={handleSaveComments}>저장</Button>
      </div>

      {/* 스크롤 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">1 업로드 ✓</span>
            <span className="text-gray-300 mx-1">›</span>
            <span className="rounded-full w-5 h-5 flex items-center justify-center font-bold bg-primary text-primary-foreground">2</span>
            <span className="font-medium">코멘트 작성</span>
          </div>

          {loadingUrls ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-400 mt-2">사진 불러오는 중...</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                각 사진의 날짜를 지정하고 코멘트를 남겨주세요. ↑↓ 버튼으로 순서를 바꿀 수 있습니다.
              </p>

              {photosByDay.map(({ dayIdx, dateLabel, photos: dayPhotos }) =>
                dayPhotos.length === 0 ? null : (
                  <section key={dayIdx} className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] flex items-center justify-center font-bold">
                        {dayIdx + 1}
                      </span>
                      {getDayLabel(dayIdx)} · {dateLabel}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {dayPhotos.map((photo, i) => (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                          signedUrl={signedUrls[photo.storagePath]}
                          days={trip.days}
                          isFirst={i === 0}
                          isLast={i === dayPhotos.length - 1}
                          onChange={handlePhotoChange}
                          onMoveUp={() => handleReorderPhoto(photo.id, 'up')}
                          onMoveDown={() => handleReorderPhoto(photo.id, 'down')}
                        />
                      ))}
                    </div>
                  </section>
                )
              )}

              {unassigned.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-amber-600">날짜 미지정 사진</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {unassigned.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        signedUrl={signedUrls[photo.storagePath]}
                        days={trip.days}
                        isFirst={true}
                        isLast={true}
                        onChange={handlePhotoChange}
                        onMoveUp={() => {}}
                        onMoveDown={() => {}}
                      />
                    ))}
                  </div>
                </section>
              )}

              {photoMeta.length === 0 && (
                <div className="text-center py-12 text-sm text-gray-400">
                  사진이 없습니다. 위의 &ldquo;사진 추가&rdquo; 버튼으로 추가하세요.
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => {
                  handleSaveComments()
                  onPrint()
                }}
              >
                <Printer className="h-4 w-4 mr-1.5" />PDF 보기 / 다운로드
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PhotoCard({
  photo, signedUrl, days, isFirst, isLast, onChange, onMoveUp, onMoveDown,
}: {
  photo: ReportPhotoMeta
  signedUrl?: string
  days: { date: string }[]
  isFirst: boolean
  isLast: boolean
  onChange: (id: string, field: keyof ReportPhotoMeta, value: string | number) => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      <div className="relative w-full aspect-[4/3] bg-gray-100">
        {signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signedUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera className="h-8 w-8 text-gray-300" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {!isFirst && (
            <button
              onClick={onMoveUp}
              className="bg-white/80 backdrop-blur-sm hover:bg-white rounded-md p-1.5 shadow-sm transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
            </button>
          )}
          {!isLast && (
            <button
              onClick={onMoveDown}
              className="bg-white/80 backdrop-blur-sm hover:bg-white rounded-md p-1.5 shadow-sm transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
      <div className="p-3 space-y-2">
        <Select
          value={String(photo.dayIndex)}
          onValueChange={(v) => onChange(photo.id, 'dayIndex', Number(v))}
        >
          <SelectTrigger className="h-8 text-xs">
            <span className="text-xs">{getDayLabel(photo.dayIndex)}</span>
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
  )
}
