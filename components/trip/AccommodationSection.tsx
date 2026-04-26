'use client'

import { useState } from 'react'
import { Accommodation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, MapPin, Phone, Ticket } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface AccommodationSectionProps {
  accommodations: Accommodation[]
  onAdd: (a: Omit<Accommodation, 'id'>) => void
  onUpdate: (id: string, a: Partial<Accommodation>) => void
  onDelete: (id: string) => void
}

const EMPTY: Omit<Accommodation, 'id'> = {
  name: '',
  address: '',
  checkInDate: '',
  checkInTime: '',
  checkOutDate: '',
  checkOutTime: '',
  bookingPlatform: '',
  bookingRef: '',
  phone: '',
  priceKRW: undefined,
}

function AccommodationForm({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial?: Partial<Accommodation>
  onClose: () => void
  onSave: (a: Omit<Accommodation, 'id'>) => void
}) {
  const [form, setForm] = useState<Omit<Accommodation, 'id'>>({ ...EMPTY, ...initial })
  const f = (key: keyof typeof form, val: unknown) => setForm((p) => ({ ...p, [key]: val }))

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.name ? '숙박 수정' : '숙박 추가'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>숙소 이름 *</Label>
            <Input placeholder="사라사호텔 신사이바시" value={form.name} onChange={(e) => f('name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>주소</Label>
            <Input placeholder="Osaka, Chuo-ku" value={form.address ?? ''} onChange={(e) => f('address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>체크인 날짜</Label>
              <Input type="date" value={form.checkInDate} onChange={(e) => f('checkInDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>체크인 시각</Label>
              <Input type="time" value={form.checkInTime ?? ''} onChange={(e) => f('checkInTime', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>체크아웃 날짜</Label>
              <Input type="date" value={form.checkOutDate} onChange={(e) => f('checkOutDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>체크아웃 시각</Label>
              <Input type="time" value={form.checkOutTime ?? ''} onChange={(e) => f('checkOutTime', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>예약 플랫폼</Label>
              <Input placeholder="아고다" value={form.bookingPlatform ?? ''} onChange={(e) => f('bookingPlatform', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>예약번호</Label>
              <Input placeholder="1687417333" value={form.bookingRef ?? ''} onChange={(e) => f('bookingRef', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>연락처</Label>
              <Input placeholder="+81 6-6241-3391" value={form.phone ?? ''} onChange={(e) => f('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>가격 (₩)</Label>
              <Input
                type="number"
                placeholder="188189"
                value={form.priceKRW ?? ''}
                onChange={(e) => f('priceKRW', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={() => { onSave(form); onClose() }} disabled={!form.name}>저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function AccommodationSection({ accommodations, onAdd, onUpdate, onDelete }: AccommodationSectionProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editAcc, setEditAcc] = useState<Accommodation | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">숙박</h3>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />추가
        </Button>
      </div>

      {accommodations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          숙박 정보를 추가하세요
        </p>
      )}

      {accommodations.map((acc) => (
        <div key={acc.id} className="rounded-xl border bg-gradient-to-br from-violet-50 to-white p-4 group relative">
          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditAcc(acc)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => onDelete(acc.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          <p className="font-semibold text-base pr-14">{acc.name}</p>
          {acc.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />{acc.address}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg p-2 border border-violet-100">
              <p className="text-xs text-muted-foreground">체크인</p>
              <p className="text-sm font-semibold">{acc.checkInDate ? formatDate(acc.checkInDate) : '-'}</p>
              {acc.checkInTime && <p className="text-xs text-violet-600">{acc.checkInTime}</p>}
            </div>
            <div className="bg-white rounded-lg p-2 border border-violet-100">
              <p className="text-xs text-muted-foreground">체크아웃</p>
              <p className="text-sm font-semibold">{acc.checkOutDate ? formatDate(acc.checkOutDate) : '-'}</p>
              {acc.checkOutTime && <p className="text-xs text-violet-600">{acc.checkOutTime}</p>}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-violet-100 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {acc.bookingPlatform && <span>{acc.bookingPlatform}</span>}
            {acc.bookingRef && (
              <span className="flex items-center gap-1">
                <Ticket className="h-3 w-3" /><span className="font-mono font-semibold text-foreground">{acc.bookingRef}</span>
              </span>
            )}
            {acc.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />{acc.phone}
              </span>
            )}
            {acc.priceKRW && (
              <span className="ml-auto font-semibold text-foreground">₩{acc.priceKRW.toLocaleString()}</span>
            )}
          </div>
        </div>
      ))}

      <AccommodationForm open={addOpen} onClose={() => setAddOpen(false)} onSave={onAdd} />
      {editAcc && (
        <AccommodationForm
          open={!!editAcc}
          initial={editAcc}
          onClose={() => setEditAcc(null)}
          onSave={(data) => { onUpdate(editAcc.id, data); setEditAcc(null) }}
        />
      )}
    </div>
  )
}
