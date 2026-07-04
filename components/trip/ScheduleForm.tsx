'use client'

import { useEffect, useRef, useState } from 'react'
import { ScheduleItem, ScheduleItemType, TransportType, ITEM_TYPE_LABELS, TRANSPORT_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ScheduleFormProps {
  open: boolean
  initial?: Partial<ScheduleItem>
  onClose: () => void
  onSave: (data: Omit<ScheduleItem, 'id'>) => void
}

const EMPTY: Omit<ScheduleItem, 'id'> = {
  type: 'attraction',
  title: '',
  time: '',
  duration: undefined,
  transportToNext: undefined,
  notes: '',
  price: undefined,
  currency: undefined,
}

export default function ScheduleForm({ open, initial, onClose, onSave }: ScheduleFormProps) {
  const [form, setForm] = useState<Omit<ScheduleItem, 'id'>>({
    ...EMPTY,
    ...initial,
  })

  const [locationName, setLocationName] = useState(initial?.location?.name ?? '')
  const [locationLat, setLocationLat] = useState(initial?.location?.lat ?? 0)
  const [locationLng, setLocationLng] = useState(initial?.location?.lng ?? 0)
  const locationInputRef = useRef<HTMLInputElement>(null)

  // Google Places Autocomplete — API가 로드된 경우에만 활성화
  useEffect(() => {
    if (!open) return
    const el = locationInputRef.current
    if (!el) return

    const getGoogle = () => (window as unknown as { google?: typeof google }).google

    const tryInit = (): google.maps.MapsEventListener | null => {
      const g = getGoogle()
      if (!g?.maps?.places?.Autocomplete) return null

      const autocomplete = new g.maps.places.Autocomplete(el, {
        fields: ['name', 'geometry'],
      })
      const listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place.geometry?.location) {
          setLocationName(place.name ?? '')
          setLocationLat(place.geometry.location.lat())
          setLocationLng(place.geometry.location.lng())
        }
      })
      return listener
    }

    let listener: google.maps.MapsEventListener | null = tryInit()
    if (!listener) {
      // Google Maps가 아직 로드 중인 경우 잠시 후 재시도
      const timer = setTimeout(() => { listener = tryInit() }, 1000)
      return () => clearTimeout(timer)
    }
    return () => {
      if (listener) getGoogle()?.maps?.event?.removeListener(listener)
    }
  }, [open])

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({
      ...form,
      location: locationName.trim()
        ? { name: locationName.trim(), lat: locationLat, lng: locationLng }
        : undefined,
    })
    setForm(EMPTY)
    setLocationName('')
    setLocationLat(0)
    setLocationLng(0)
  }

  const handleClose = () => {
    setForm(EMPTY)
    setLocationName('')
    setLocationLat(0)
    setLocationLng(0)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.title ? '일정 수정' : '일정 추가'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>카테고리</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as ScheduleItemType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ITEM_TYPE_LABELS) as ScheduleItemType[]).map((k) => (
                    <SelectItem key={k} value={k}>{ITEM_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>시간</Label>
              <Input
                type="time"
                value={form.time ?? ''}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input
              placeholder="예: 도쿄 타워 방문"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>장소 검색</Label>
            <Input
              ref={locationInputRef}
              placeholder="예: Tokyo Tower"
              value={locationName}
              onChange={(e) => {
                setLocationName(e.target.value)
                // 직접 타이핑 시 좌표 초기화
                setLocationLat(0)
                setLocationLng(0)
              }}
            />
            {locationLat !== 0 && (
              <p className="text-xs text-emerald-600">지도 마커 연결됨</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>소요시간 (분)</Label>
              <Input
                type="number"
                min={0}
                placeholder="예: 90"
                value={form.duration ?? ''}
                onChange={(e) => setForm({ ...form, duration: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>다음 장소 이동수단</Label>
              <Select
                value={form.transportToNext ?? ''}
                onValueChange={(v) => setForm({ ...form, transportToNext: v ? v as TransportType : undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택 안함" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">선택 안함</SelectItem>
                  {(Object.keys(TRANSPORT_LABELS) as TransportType[]).map((k) => (
                    <SelectItem key={k} value={k}>{TRANSPORT_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>금액</Label>
              <Input
                type="number"
                min={0}
                placeholder="예: 3000"
                value={form.price ?? ''}
                onChange={(e) => setForm({ ...form, price: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>통화</Label>
              <Input
                placeholder="JPY / KRW"
                value={form.currency ?? ''}
                onChange={(e) => setForm({ ...form, currency: e.target.value || undefined })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Input
              placeholder="입장료, 예약 번호 등"
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>취소</Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
