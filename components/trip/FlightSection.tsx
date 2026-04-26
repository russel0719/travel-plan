'use client'

import { useState } from 'react'
import { Flight } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, PlaneTakeoff, PlaneLanding, Ticket } from 'lucide-react'

interface FlightSectionProps {
  flights: Flight[]
  onAdd: (f: Omit<Flight, 'id'>) => void
  onUpdate: (id: string, f: Partial<Flight>) => void
  onDelete: (id: string) => void
}

const EMPTY: Omit<Flight, 'id'> = {
  direction: 'outbound',
  airline: '',
  flightNumber: '',
  departureAirport: '',
  departureDate: '',
  departureTime: '',
  arrivalAirport: '',
  arrivalDate: '',
  arrivalTime: '',
  bookingRef: '',
  seat: '',
  priceKRW: undefined,
}

function FlightForm({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial?: Partial<Flight>
  onClose: () => void
  onSave: (f: Omit<Flight, 'id'>) => void
}) {
  const [form, setForm] = useState<Omit<Flight, 'id'>>({ ...EMPTY, ...initial })
  const f = (key: keyof typeof form, val: unknown) => setForm((p) => ({ ...p, [key]: val }))

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.flightNumber ? '항공권 수정' : '항공권 추가'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            {(['outbound', 'inbound'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => f('direction', d)}
                className={`flex-1 py-1.5 rounded-md text-sm border transition-colors ${
                  form.direction === d
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-muted'
                }`}
              >
                {d === 'outbound' ? '출국편' : '귀국편'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>항공사</Label>
              <Input placeholder="이스타항공" value={form.airline} onChange={(e) => f('airline', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>편명</Label>
              <Input placeholder="ZE613" value={form.flightNumber} onChange={(e) => f('flightNumber', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>출발 공항</Label>
              <Input placeholder="인천" value={form.departureAirport} onChange={(e) => f('departureAirport', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>도착 공항</Label>
              <Input placeholder="간사이" value={form.arrivalAirport} onChange={(e) => f('arrivalAirport', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>출발 날짜</Label>
              <Input type="date" value={form.departureDate} onChange={(e) => f('departureDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>출발 시간</Label>
              <Input type="time" value={form.departureTime} onChange={(e) => f('departureTime', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>도착 날짜</Label>
              <Input type="date" value={form.arrivalDate} onChange={(e) => f('arrivalDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>도착 시간</Label>
              <Input type="time" value={form.arrivalTime} onChange={(e) => f('arrivalTime', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>예약번호</Label>
              <Input placeholder="U53W5C" value={form.bookingRef ?? ''} onChange={(e) => f('bookingRef', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>좌석</Label>
              <Input placeholder="12A" value={form.seat ?? ''} onChange={(e) => f('seat', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>가격 (₩)</Label>
            <Input
              type="number"
              placeholder="115000"
              value={form.priceKRW ?? ''}
              onChange={(e) => f('priceKRW', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={() => { onSave(form); onClose() }} disabled={!form.flightNumber || !form.departureAirport}>저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function FlightSection({ flights, onAdd, onUpdate, onDelete }: FlightSectionProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editFlight, setEditFlight] = useState<Flight | null>(null)

  const outbound = flights.filter((f) => f.direction === 'outbound')
  const inbound = flights.filter((f) => f.direction === 'inbound')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">항공권</h3>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />추가
        </Button>
      </div>

      {flights.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          항공권 정보를 추가하세요
        </p>
      )}

      {[...outbound, ...inbound].map((flight) => (
        <div key={flight.id} className="rounded-xl border bg-gradient-to-br from-indigo-50 to-white p-4 group relative">
          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditFlight(flight)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => onDelete(flight.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-xs border-indigo-300 text-indigo-700 bg-indigo-50">
              {flight.direction === 'outbound' ? '출국편' : '귀국편'}
            </Badge>
            <span className="text-xs text-muted-foreground">{flight.airline}</span>
            <span className="text-xs font-mono font-semibold">{flight.flightNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-center min-w-[70px]">
              <p className="text-xl font-bold">{flight.departureTime}</p>
              <p className="text-xs text-muted-foreground">{flight.departureAirport}</p>
              <p className="text-xs text-muted-foreground">{flight.departureDate.slice(5)}</p>
            </div>
            <div className="flex-1 flex flex-col items-center gap-0.5">
              <PlaneTakeoff className="h-3.5 w-3.5 text-indigo-400" />
              <div className="w-full h-px bg-indigo-200" />
              <PlaneLanding className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <div className="text-center min-w-[70px]">
              <p className="text-xl font-bold">{flight.arrivalTime}</p>
              <p className="text-xs text-muted-foreground">{flight.arrivalAirport}</p>
              <p className="text-xs text-muted-foreground">{flight.arrivalDate.slice(5)}</p>
            </div>
          </div>

          {(flight.bookingRef || flight.seat || flight.priceKRW) && (
            <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {flight.bookingRef && (
                <span className="flex items-center gap-1">
                  <Ticket className="h-3 w-3" />예약번호 <span className="font-mono font-semibold text-foreground">{flight.bookingRef}</span>
                </span>
              )}
              {flight.seat && <span>좌석 {flight.seat}</span>}
              {flight.priceKRW && (
                <span className="ml-auto font-semibold text-foreground">₩{flight.priceKRW.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      ))}

      <FlightForm open={addOpen} onClose={() => setAddOpen(false)} onSave={onAdd} />
      {editFlight && (
        <FlightForm
          open={!!editFlight}
          initial={editFlight}
          onClose={() => setEditFlight(null)}
          onSave={(data) => { onUpdate(editFlight.id, data); setEditFlight(null) }}
        />
      )}
    </div>
  )
}
