'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ScheduleItem,
  ScheduleItemType,
  TransportType,
  ITEM_TYPE_LABELS,
  TRANSPORT_LABELS,
  CATEGORY_EXTRA_FIELDS,
  MEAL_TYPE_LABELS,
  CHECK_TYPE_LABELS,
  MealType,
  CheckType,
} from '@/lib/types'
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
  mealType: undefined,
  reservationNeeded: undefined,
  checkType: undefined,
  transportMode: undefined,
}

function hasField(type: ScheduleItemType, field: string): boolean {
  return CATEGORY_EXTRA_FIELDS[type].includes(field)
}

// Select.Root에 items를 넘겨야 트리거에 raw value 대신 라벨이 표시된다
const TRANSPORT_SELECT_ITEMS: Record<string, string> = { '': '선택 안함', ...TRANSPORT_LABELS }
const MEAL_SELECT_ITEMS: Record<string, string> = { '': '선택 안함', ...MEAL_TYPE_LABELS }
const CHECK_SELECT_ITEMS: Record<string, string> = { '': '선택 안함', ...CHECK_TYPE_LABELS }

// 카테고리별로 다른 예시 문구를 보여주기 위한 placeholder 모음
const CATEGORY_PLACEHOLDERS: Record<ScheduleItemType, { title: string; location: string; notes: string }> = {
  attraction: {
    title: '예: 도쿄 타워 방문',
    location: '예: Tokyo Tower',
    notes: '입장료, 예약 정보 등',
  },
  restaurant: {
    title: '예: 이치란 라멘 신주쿠점',
    location: '예: Ichiran Ramen Shinjuku',
    notes: '예약 여부, 웨이팅 시간, 알레르기 등',
  },
  hotel: {
    title: '예: 신주쿠 그랜드 호텔 체크인',
    location: '예: Shinjuku Granbell Hotel',
    notes: '예약 번호, 조식 포함 여부 등',
  },
  transport: {
    title: '예: 나리타공항 → 신주쿠역 이동',
    location: '예: 신주쿠역',
    notes: '환승 정보, 좌석 등급 등',
  },
}

// Google Places Autocomplete를 인풋에 연결한다 — API가 아직 로드 중이면 잠시 후 재시도.
// TODO: google.maps.places.Autocomplete는 2025-03-01부로 신규 고객에게 제공되지 않는 legacy API로,
// 이후 버그 수정도 없다. 아직 폐지 예정은 없으나(최소 12개월 사전 고지), 후속 버전에서 웹 컴포넌트인
// google.maps.places.PlaceAutocompleteElement(<gmp-place-autocomplete>)로 마이그레이션 검토 필요.
// 단, 그 컴포넌트는 Shadow DOM에 자체 입력창을 렌더링하므로 지금의 Input 디자인과 다르게 보이고
// place_changed → gmp-select 이벤트, getPlace() → place.fetchFields() 비동기 호출로 API 형태도 바뀐다.
function usePlacesAutocomplete(
  ref: React.RefObject<HTMLInputElement | null>,
  active: boolean,
  onPlace: (name: string, lat: number, lng: number) => void
) {
  const onPlaceRef = useRef(onPlace)
  useEffect(() => {
    onPlaceRef.current = onPlace
  })

  useEffect(() => {
    if (!active) return
    const el = ref.current
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
          onPlaceRef.current(place.name ?? '', place.geometry.location.lat(), place.geometry.location.lng())
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
  }, [active, ref])
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

  const [fromLocationName, setFromLocationName] = useState(initial?.fromLocation?.name ?? '')
  const [fromLocationLat, setFromLocationLat] = useState(initial?.fromLocation?.lat ?? 0)
  const [fromLocationLng, setFromLocationLng] = useState(initial?.fromLocation?.lng ?? 0)
  const fromLocationInputRef = useRef<HTMLInputElement>(null)

  usePlacesAutocomplete(locationInputRef, open, (name, lat, lng) => {
    setLocationName(name)
    setLocationLat(lat)
    setLocationLng(lng)
  })

  usePlacesAutocomplete(fromLocationInputRef, open && hasField(form.type, 'fromLocation'), (name, lat, lng) => {
    setFromLocationName(name)
    setFromLocationLat(lat)
    setFromLocationLng(lng)
  })

  const resetLocations = () => {
    setLocationName('')
    setLocationLat(0)
    setLocationLng(0)
    setFromLocationName('')
    setFromLocationLat(0)
    setFromLocationLng(0)
  }

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({
      ...form,
      location: locationName.trim()
        ? { name: locationName.trim(), lat: locationLat, lng: locationLng }
        : undefined,
      fromLocation: hasField(form.type, 'fromLocation') && fromLocationName.trim()
        ? { name: fromLocationName.trim(), lat: fromLocationLat, lng: fromLocationLng }
        : undefined,
    })
    setForm(EMPTY)
    resetLocations()
  }

  const handleClose = () => {
    setForm(EMPTY)
    resetLocations()
    onClose()
  }

  const showMealType = hasField(form.type, 'mealType')
  const showCheckType = hasField(form.type, 'checkType')
  const showReservation = hasField(form.type, 'reservationNeeded')
  const showFromLocation = hasField(form.type, 'fromLocation')
  const showTransportMode = hasField(form.type, 'transportMode')

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
                items={ITEM_TYPE_LABELS}
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
              placeholder={CATEGORY_PLACEHOLDERS[form.type].title}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          {showFromLocation && (
            <div className="space-y-1.5">
              <Label>출발지</Label>
              <Input
                ref={fromLocationInputRef}
                placeholder="예: 나리타 공항"
                value={fromLocationName}
                onChange={(e) => {
                  setFromLocationName(e.target.value)
                  setFromLocationLat(0)
                  setFromLocationLng(0)
                }}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{showFromLocation ? '도착지' : '장소 검색'}</Label>
            <Input
              ref={locationInputRef}
              placeholder={CATEGORY_PLACEHOLDERS[form.type].location}
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
          {(showMealType || showCheckType) && (
            <div className="grid grid-cols-2 gap-3">
              {showMealType && (
                <div className="space-y-1.5">
                  <Label>식사 유형</Label>
                  <Select
                    items={MEAL_SELECT_ITEMS}
                    value={form.mealType ?? ''}
                    onValueChange={(v) => setForm({ ...form, mealType: v ? v as MealType : undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="선택 안함" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">선택 안함</SelectItem>
                      {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((k) => (
                        <SelectItem key={k} value={k}>{MEAL_TYPE_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {showCheckType && (
                <div className="space-y-1.5">
                  <Label>체크인/체크아웃</Label>
                  <Select
                    items={CHECK_SELECT_ITEMS}
                    value={form.checkType ?? ''}
                    onValueChange={(v) => setForm({ ...form, checkType: v ? v as CheckType : undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="선택 안함" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">선택 안함</SelectItem>
                      {(Object.keys(CHECK_TYPE_LABELS) as CheckType[]).map((k) => (
                        <SelectItem key={k} value={k}>{CHECK_TYPE_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          {showTransportMode && (
            <div className="space-y-1.5">
              <Label>이동수단</Label>
              <Select
                items={TRANSPORT_SELECT_ITEMS}
                value={form.transportMode ?? ''}
                onValueChange={(v) => setForm({ ...form, transportMode: v ? v as TransportType : undefined })}
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
          )}
          {showReservation && (
            <Button
              type="button"
              variant="outline"
              className={form.reservationNeeded ? 'border-primary bg-primary/10 text-primary' : ''}
              onClick={() => setForm({ ...form, reservationNeeded: !form.reservationNeeded })}
            >
              예약 필요{form.reservationNeeded ? ' ✓' : ''}
            </Button>
          )}
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
                items={TRANSPORT_SELECT_ITEMS}
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
              placeholder={CATEGORY_PLACEHOLDERS[form.type].notes}
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
