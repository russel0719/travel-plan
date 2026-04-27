'use client'

import { useEffect, useRef, useState } from 'react'
import { useTripStore } from '@/store/tripStore'
import { compressAndUpload } from '@/lib/reportStorage'
import { generateId } from '@/lib/utils'
import { ArrowLeft, ImagePlus, X, Upload, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MAX_PHOTOS = 50

interface PhotoFile {
  id: string
  file: File
  previewUrl: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  storagePath?: string
}

interface ReportUploadPanelProps {
  tripId: string
  onCreated: (reportId: string) => void
  onBack: () => void
}

export default function ReportUploadPanel({ tripId, onCreated, onBack }: ReportUploadPanelProps) {
  const { getTrip, userId, addReport, updateReport } = useTripStore()
  const trip = getTrip(tripId)

  const [title, setTitle] = useState('')
  const [reportId] = useState(() => generateId())
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const reportCreatedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (trip && !title) setTitle(`${trip.title} 여행 후기`)
  }, [trip, title])

  useEffect(() => {
    return () => { photos.forEach((p) => URL.revokeObjectURL(p.previewUrl)) }
  }, [photos])

  if (!trip) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remaining = MAX_PHOTOS - photos.length
    const toAdd = files.slice(0, remaining)
    setPhotos((prev) => [
      ...prev,
      ...toAdd.map((file) => ({
        id: generateId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending' as const,
      })),
    ])
    e.target.value = ''
  }

  const handleRemove = (id: string) => {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id)
      if (p) URL.revokeObjectURL(p.previewUrl)
      return prev.filter((x) => x.id !== id)
    })
  }

  const handleUpload = async () => {
    if (!userId) return
    setIsUploading(true)
    for (const photo of photos.filter((p) => p.status === 'pending')) {
      setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, status: 'uploading' } : p))
      try {
        const storagePath = `${userId}/${tripId}/${reportId}/${photo.id}.jpg`
        await compressAndUpload(photo.file, storagePath)
        setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, status: 'done', storagePath } : p))
        if (!reportCreatedRef.current) {
          reportCreatedRef.current = true
          addReport(tripId, {
            title,
            status: 'draft',
            photoMeta: [],
            userNotes: '',
            aiGeneratedText: '',
            aiDayTexts: {},
            scheduleSummary: '',
          }, reportId)
        }
      } catch {
        setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, status: 'error' } : p))
      }
    }
    setIsUploading(false)
  }

  const handleNext = () => {
    if (!userId) return
    const uploaded = photos.filter((p) => p.status === 'done' && p.storagePath)
    updateReport(tripId, reportId, {
      title,
      photoMeta: uploaded.map((p, i) => ({
        id: p.id,
        storagePath: p.storagePath!,
        dayIndex: 0,
        order: i,
        comment: '',
      })),
    })
    onCreated(reportId)
  }

  const doneCount = photos.filter((p) => p.status === 'done').length
  const pendingCount = photos.filter((p) => p.status === 'pending').length
  const allUploaded = photos.length > 0 && pendingCount === 0 && !isUploading

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* 뒤로 + 단계 표시 */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />뒤로
          </Button>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span>
            <span className="font-medium">사진 업로드</span>
            <span className="text-gray-300 mx-1">›</span>
            <span className="text-gray-400">2 코멘트 & PDF</span>
          </div>
        </div>

        {/* 제목 */}
        <div className="space-y-1.5">
          <Label htmlFor="report-title">후기 제목</Label>
          <Input
            id="report-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* 업로드 영역 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>
              사진{' '}
              <span className="text-muted-foreground font-normal text-xs">({photos.length}/{MAX_PHOTOS}장)</span>
            </Label>
            {photos.length < MAX_PHOTOS && (
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-1" />사진 추가
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {photos.length === 0 ? (
            <button
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-12 text-center hover:border-gray-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 font-medium">클릭해서 사진 선택</p>
              <p className="text-xs text-gray-400 mt-1">최대 {MAX_PHOTOS}장 · 자동 압축</p>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                  {photo.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  )}
                  {photo.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500/50 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">실패</span>
                    </div>
                  )}
                  {photo.status === 'done' && (
                    <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-0.5">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  )}
                  {photo.status === 'pending' && (
                    <button
                      onClick={() => handleRemove(photo.id)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        {photos.length > 0 && (
          <div className="space-y-3">
            {pendingCount > 0 && (
              <Button className="w-full" onClick={handleUpload} disabled={isUploading}>
                {isUploading
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />업로드 중 ({doneCount}/{photos.length})</>
                  : <><Upload className="h-4 w-4 mr-1.5" />{pendingCount}장 업로드</>
                }
              </Button>
            )}
            {doneCount > 0 && (
              <Button
                className="w-full"
                variant={allUploaded ? 'default' : 'outline'}
                onClick={handleNext}
                disabled={isUploading}
              >
                {doneCount}장 완료 · 코멘트 작성 →
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
