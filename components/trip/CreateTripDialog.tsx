'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDaysBetween } from '@/lib/utils'

interface CreateTripDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (data: {
    title: string
    destination: string
    startDate: string
    endDate: string
    isInternational: boolean
  }) => void
}

function buildAutoTitle(destination: string, startDate: string, endDate: string): string {
  if (!destination || !startDate || !endDate) return ''
  const days = getDaysBetween(startDate, endDate).length
  if (days <= 1) return `${destination} 당일치기`
  return `${destination} ${days - 1}박 ${days}일`
}

export default function CreateTripDialog({ open, onClose, onCreate }: CreateTripDialogProps) {
  const [form, setForm] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    isInternational: false,
  })
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false)

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }

      // 제목이 직접 수정되지 않은 경우에만 자동 생성
      if (!titleManuallyEdited) {
        const dest = key === 'destination' ? String(value) : prev.destination
        const start = key === 'startDate' ? String(value) : prev.startDate
        const end = key === 'endDate' ? String(value) : prev.endDate
        next.title = buildAutoTitle(dest, start, end)
      }

      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.destination || !form.startDate || !form.endDate) return
    onCreate(form)
    setForm({ title: '', destination: '', startDate: '', endDate: '', isInternational: false })
    setTitleManuallyEdited(false)
  }

  const handleClose = () => {
    setForm({ title: '', destination: '', startDate: '', endDate: '', isInternational: false })
    setTitleManuallyEdited(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 여행 만들기</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="destination">목적지</Label>
            <Input
              id="destination"
              placeholder="예: 일본 도쿄"
              value={form.destination}
              onChange={(e) => updateField('destination', e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">출발일</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">귀국일</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">
              여행 제목
              {!titleManuallyEdited && form.title && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">자동 생성됨</span>
              )}
            </Label>
            <Input
              id="title"
              placeholder="예: 도쿄 3박 4일"
              value={form.title}
              onChange={(e) => {
                setTitleManuallyEdited(true)
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isInternational"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={form.isInternational}
              onChange={(e) => updateField('isInternational', e.target.checked)}
            />
            <Label htmlFor="isInternational" className="cursor-pointer font-normal">
              해외여행
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>취소</Button>
            <Button type="submit">만들기</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
