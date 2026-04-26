'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

export default function CreateTripDialog({ open, onClose, onCreate }: CreateTripDialogProps) {
  const [form, setForm] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    isInternational: false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.destination || !form.startDate || !form.endDate) return
    onCreate(form)
    setForm({ title: '', destination: '', startDate: '', endDate: '', isInternational: false })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 여행 만들기</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">여행 제목</Label>
            <Input
              id="title"
              placeholder="예: 도쿄 3박 4일"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destination">목적지</Label>
            <Input
              id="destination"
              placeholder="예: 일본 도쿄"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
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
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
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
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isInternational"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={form.isInternational}
              onChange={(e) => setForm({ ...form, isInternational: e.target.checked })}
            />
            <Label htmlFor="isInternational" className="cursor-pointer font-normal">
              해외여행
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit">만들기</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
