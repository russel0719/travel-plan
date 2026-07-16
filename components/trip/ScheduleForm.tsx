'use client'

import { useState } from 'react'
import {
  ScheduleItem,
  ScheduleItemType,
  TransportType,
  Accommodation,
  ITEM_TYPE_LABELS,
  TRANSPORT_LABELS,
  CATEGORY_EXTRA_FIELDS,
  MEAL_TYPE_LABELS,
  CHECK_TYPE_LABELS,
  MealType,
  CheckType,
} from '@/lib/types'
import PlaceAutocompleteInput from '@/components/place/PlaceAutocompleteInput'
import { SelectedPlace } from '@/lib/places'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ScheduleFormProps {
  open: boolean
  initial?: Partial<ScheduleItem>
  accommodations?: Accommodation[]
  dayDate?: string
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
  placePhotoUrl: undefined,
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

export default function ScheduleForm({ open, initial, accommodations, dayDate, onClose, onSave }: ScheduleFormProps) {
  const [form, setForm] = useState<Omit<ScheduleItem, 'id'>>({
    ...EMPTY,
    ...initial,
  })

  const [locationName, setLocationName] = useState(initial?.location?.name ?? '')
  const [locationLat, setLocationLat] = useState(initial?.location?.lat ?? 0)
  const [locationLng, setLocationLng] = useState(initial?.location?.lng ?? 0)

  const [fromLocationName, setFromLocationName] = useState(initial?.fromLocation?.name ?? '')
  const [fromLocationLat, setFromLocationLat] = useState(initial?.fromLocation?.lat ?? 0)
  const [fromLocationLng, setFromLocationLng] = useState(initial?.fromLocation?.lng ?? 0)

  const selectLocation = (place: SelectedPlace) => {
    setLocationName(place.name)
    setLocationLat(place.lat)
    setLocationLng(place.lng)
    setForm((prev) => ({ ...prev, placePhotoUrl: place.photoUrl }))
  }

  const resetLocations = () => {
    setLocationName('')
    setLocationLat(0)
    setLocationLng(0)
    setFromLocationName('')
    setFromLocationLat(0)
    setFromLocationLng(0)
  }

  // 일정 날짜(dayDate)의 체크인~체크아웃 기간에 겹치는 숙소들.
  const dayMatchedAccommodations = dayDate
    ? (accommodations ?? []).filter((a) => a.checkInDate <= dayDate && dayDate <= a.checkOutDate)
    : []

  // 검색을 여행지 근처로 편향시킨다 — 도쿄 여행 중 "스타벅스"를 치면 서울 지점이 뜨는 걸 막는다.
  // trip.destination은 문자열이라 좌표가 없으므로 그 날 묵는 숙소를, 없으면 아무 숙소나 기준으로 쓴다.
  const hasCoords = (a: Accommodation) => a.lat != null && a.lng != null
  const biasSource = dayMatchedAccommodations.find(hasCoords) ?? (accommodations ?? []).find(hasCoords)
  const locationBias = biasSource ? { lat: biasSource.lat!, lng: biasSource.lng! } : undefined

  const applyAccommodation = (acc: Accommodation) => {
    setLocationName(acc.name)
    setLocationLat(acc.lat ?? 0)
    setLocationLng(acc.lng ?? 0)
    setForm((prev) => {
      const notesParts = [
        acc.bookingRef ? `예약번호 ${acc.bookingRef}` : null,
        acc.phone ? `연락처 ${acc.phone}` : null,
      ].filter((v): v is string => !!v)
      return {
        ...prev,
        checkType:
          dayDate === acc.checkInDate ? 'checkin' : dayDate === acc.checkOutDate ? 'checkout' : prev.checkType,
        notes: prev.notes?.trim() ? prev.notes : notesParts.length ? notesParts.join(' / ') : prev.notes,
      }
    })
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
  const showAccommodationPicker =
    form.type === 'hotel' && dayMatchedAccommodations.length !== 1 && (accommodations?.length ?? 0) > 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.title ? '일정 수정' : '일정 추가'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div key="category-time" className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>카테고리</Label>
              <Select
                items={ITEM_TYPE_LABELS}
                value={form.type}
                onValueChange={(v) => {
                  const type = v as ScheduleItemType
                  setForm({ ...form, type })
                  if (type === 'hotel' && !locationName.trim() && dayMatchedAccommodations.length === 1) {
                    applyAccommodation(dayMatchedAccommodations[0])
                  }
                }}
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
          <div key="title" className="space-y-1.5">
            <Label>제목 *</Label>
            <Input
              placeholder={CATEGORY_PLACEHOLDERS[form.type].title}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          {showAccommodationPicker && (
            <div key="accommodation-picker" className="space-y-1.5">
              <Label>숙소 불러오기</Label>
              <Select
                items={Object.fromEntries((accommodations ?? []).map((a) => [a.id, a.name]))}
                value=""
                onValueChange={(v) => {
                  const acc = (accommodations ?? []).find((a) => a.id === v)
                  if (acc) applyAccommodation(acc)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="등록된 숙소에서 불러오기" />
                </SelectTrigger>
                <SelectContent>
                  {(accommodations ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showFromLocation && (
            <div key="from-location" className="space-y-1.5">
              <Label>출발지</Label>
              <PlaceAutocompleteInput
                value={fromLocationName}
                onValueChange={(v) => {
                  setFromLocationName(v)
                  setFromLocationLat(0)
                  setFromLocationLng(0)
                }}
                onSelect={(place) => {
                  setFromLocationName(place.name)
                  setFromLocationLat(place.lat)
                  setFromLocationLng(place.lng)
                }}
                placeholder="예: 나리타 공항"
                locationBias={locationBias}
              />
            </div>
          )}
          <div key="location" className="space-y-1.5">
            <Label>{showFromLocation ? '도착지' : '장소 검색'}</Label>
            <PlaceAutocompleteInput
              value={locationName}
              onValueChange={(v) => {
                setLocationName(v)
                setLocationLat(0)
                setLocationLng(0)
              }}
              onSelect={selectLocation}
              placeholder={CATEGORY_PLACEHOLDERS[form.type].location}
              locationBias={locationBias}
            />
            {locationLat !== 0 && (
              <p className="text-xs text-emerald-600">지도 마커 연결됨</p>
            )}
          </div>
          {(showMealType || showCheckType) && (
            <div key="meal-check-row" className="grid grid-cols-2 gap-3">
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
            <div key="transport-mode" className="space-y-1.5">
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
              key="reservation"
              type="button"
              variant="outline"
              className={form.reservationNeeded ? 'border-primary bg-primary/10 text-primary' : ''}
              onClick={() => setForm({ ...form, reservationNeeded: !form.reservationNeeded })}
            >
              예약 필요{form.reservationNeeded ? ' ✓' : ''}
            </Button>
          )}
          <div key="duration-transport-next" className="grid grid-cols-2 gap-3">
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
          <div key="price-currency" className="grid grid-cols-2 gap-3">
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
          <div key="notes" className="space-y-1.5">
            <Label>메모</Label>
            <Input
              placeholder={CATEGORY_PLACEHOLDERS[form.type].notes}
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div key="actions" className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>취소</Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
