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
import PlaceMapPicker from '@/components/place/PlaceMapPicker'
import { SelectedPlace } from '@/lib/places'
import { MapPin } from 'lucide-react'
import { cn, formatDurationLabel, minutesToTime, parseTimeToMinutes, timeRangeMinutes } from '@/lib/utils'
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
  startTime: undefined,
  endTime: undefined,
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

// 이 일정이 얼마나 걸리는지 — 누르면 종료시각을 시작+N으로 맞춘다
const DURATION_PRESETS = [30, 60, 120]

const MAPS_ENABLED = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

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

  const [mapOpen, setMapOpen] = useState(false)
  // 좌표가 이름과 독립적으로 확정된 것인지. 검색으로 고른 좌표는 이름과 한 쌍이라 이름을 고치면
  // 더 이상 그 장소가 아니므로 무효화하는 게 맞다. 반면 지도에서 찍었거나 숙소에서 가져온 좌표는
  // "여기"라는 뜻이라 이름을 뭐라고 적든 살아남아야 한다.
  const [coordsPinned, setCoordsPinned] = useState(false)

  const selectLocation = (place: SelectedPlace) => {
    setLocationName(place.name)
    setLocationLat(place.lat)
    setLocationLng(place.lng)
    setCoordsPinned(false)
    setForm((prev) => ({ ...prev, placePhotoUrl: place.photoUrl }))
  }

  // 지도에서 POI가 아닌 빈 공간을 찍은 경우 — 이름을 알 수 없으니 좌표만 잡고, 입력칸이 비어
  // 있으면 좌표를 임시 이름으로 채워 무엇을 골랐는지 보이게 한다(사용자가 덮어쓸 수 있다).
  const pickCoords = (lat: number, lng: number) => {
    setLocationLat(lat)
    setLocationLng(lng)
    setCoordsPinned(true)
    setLocationName((prev) => (prev.trim() ? prev : `${lat.toFixed(5)}, ${lng.toFixed(5)}`))
  }

  const changeLocationName = (value: string) => {
    setLocationName(value)
    if (!coordsPinned) {
      setLocationLat(0)
      setLocationLng(0)
    }
  }

  const rangeMinutes = timeRangeMinutes(form.startTime, form.endTime)
  const crossesMidnight = rangeMinutes != null && (parseTimeToMinutes(form.endTime) ?? 0) < (parseTimeToMinutes(form.startTime) ?? 0)

  const changeStartTime = (value: string) => {
    const start = parseTimeToMinutes(value)
    if (start == null) {
      // 입력 도중(불완전한 값)이면 <input type="time">이 ''를 준다 — 종료까지 건드리지 않는다.
      setForm((prev) => ({ ...prev, startTime: value || undefined }))
      return
    }
    setForm((prev) => {
      const prevRange = timeRangeMinutes(prev.startTime, prev.endTime)
      // 종료가 이미 있으면 소요시간을 유지한 채 통째로 옮긴다 — 그러지 않으면 시작만 당겼을 때
      // 종료가 그대로 남아 소요시간이 엉뚱하게 늘거나 0이 된다. 비어 있으면 1시간을 채워준다.
      const nextRange = prevRange ?? 60
      return { ...prev, startTime: value, endTime: minutesToTime(start + nextRange) }
    })
  }

  const resetLocations = () => {
    setLocationName('')
    setLocationLat(0)
    setLocationLng(0)
    setFromLocationName('')
    setFromLocationLat(0)
    setFromLocationLng(0)
    setMapOpen(false)
    setCoordsPinned(false)
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
    setCoordsPinned(acc.lat != null)
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
      // 이름이 비어도 좌표가 있으면 저장한다 — 지도에서 빈 공간을 찍어 좌표만 잡은 뒤 이름을
      // 지운 경우, 이름만 보고 판단하면 찍어둔 좌표까지 통째로 버려진다.
      location: locationName.trim() || locationLat !== 0 || locationLng !== 0
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
          {/* 402px에서 콘텐츠 폭이 338px뿐이라 카테고리·시작·종료를 3열로 넣으면 각 105px가 되는데,
              Input이 모바일에서 16px(iOS 줌 방지)이라 네이티브 time 입력이 잘린다. 카테고리를 전체 폭으로
              빼고 시각 2개를 한 행에 둔다 — 카드 표시("10:00 ~ 11:30")와 모양이 같아지는 이점도 있다. */}
          <div key="category" className="space-y-1.5">
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
          <div key="time-range" className="space-y-1.5">
            <Label>시간</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                className="flex-1"
                value={form.startTime ?? ''}
                onChange={(e) => changeStartTime(e.target.value)}
              />
              <span className="shrink-0 text-xs text-muted-foreground">~</span>
              <Input
                type="time"
                className="flex-1"
                // 시작이 없으면 종료만 있는 건 의미가 없다. 에러를 띄우는 대신 무효 상태를 못 만들게 한다.
                disabled={!form.startTime}
                value={form.endTime ?? ''}
                onChange={(e) => setForm({ ...form, endTime: e.target.value || undefined })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DURATION_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  disabled={!form.startTime}
                  onClick={() => setForm({ ...form, endTime: minutesToTime(parseTimeToMinutes(form.startTime)! + mins) })}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50',
                    rangeMinutes === mins ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
                  )}
                >
                  {formatDurationLabel(mins)}
                </button>
              ))}
              {rangeMinutes != null && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {crossesMidnight && <span className="mr-1 text-amber-600">익일</span>}
                  {formatDurationLabel(rangeMinutes)}
                </span>
              )}
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
              onValueChange={changeLocationName}
              onSelect={selectLocation}
              placeholder={CATEGORY_PLACEHOLDERS[form.type].location}
              locationBias={locationBias}
            />
            {/* API 키가 없으면 지도를 띄울 수 없으므로 토글 자체를 감춘다 */}
            {MAPS_ENABLED && (
              <div className="flex items-center justify-between gap-2">
                {locationLat !== 0 ? (
                  <p className="text-xs text-emerald-600">지도 마커 연결됨</p>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => setMapOpen((v) => !v)}
                >
                  <MapPin className="mr-1 h-3 w-3" />
                  {mapOpen ? '지도 닫기' : '지도에서 선택'}
                </Button>
              </div>
            )}
            {/* 기본은 닫힌 상태다 — Map을 마운트하는 순간 지도 타일이 과금된다 */}
            {mapOpen && (
              <div className="space-y-1">
                <PlaceMapPicker
                  selected={locationLat !== 0 ? { lat: locationLat, lng: locationLng } : undefined}
                  fallbackCenter={locationBias}
                  onSelect={selectLocation}
                  onPickCoords={pickCoords}
                />
                <p className="text-xs text-muted-foreground">지도의 장소를 탭하면 정보가 채워집니다</p>
              </div>
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
          <div key="transport-next" className="space-y-1.5">
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
