'use client'

import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { usePlaceSuggestions, PlaceSuggestion } from '@/hooks/usePlaceSuggestions'
import { fetchSelectedPlace, SelectedPlace } from '@/lib/places'
import { cn } from '@/lib/utils'

interface PlaceAutocompleteInputProps {
  value: string
  /** 사용자가 직접 타이핑한 경우. 좌표 무효화는 호출부 책임이다. */
  onValueChange: (value: string) => void
  onSelect: (place: SelectedPlace) => void
  placeholder?: string
  /** displayName/location/photos 외에 추가로 받을 Place 필드 (예: 'formattedAddress') */
  extraFields?: string[]
  /** 검색 결과를 이 좌표 근처로 편향시킨다 (예: 그 날 묵는 숙소) */
  locationBias?: google.maps.LatLngLiteral
}

export default function PlaceAutocompleteInput({
  value,
  onValueChange,
  onSelect,
  placeholder,
  extraFields,
  locationBias,
}: PlaceAutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const { suggestions, status, available, endSession } = usePlaceSuggestions(value, locationBias)
  const listId = useId()

  const select = (s: PlaceSuggestion) => {
    setOpen(false)
    setActiveIndex(-1)
    onValueChange(s.mainText)
    // toPlace()는 선택 시점에 lazy하게 부른다 — 세션 토큰은 그 Place의 첫 fetchFields에 자동으로
    // 첨부되므로 미리 만들어두면 토큰이 엉뚱한 시점에 소비된다.
    fetchSelectedPlace(s.prediction.toPlace(), extraFields)
      .then(onSelect)
      .catch((err) => console.error('Place Details(fetchFields) 실패:', err))
      .finally(endSession)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return // Esc가 다이얼로그까지 전파되도록 그대로 둔다

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      select(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      // 목록이 열려 있을 때의 Esc는 목록만 닫는다 — 전파를 막지 않으면 Base UI Dialog가 같이
      // 닫혀서 입력하던 폼이 통째로 날아간다.
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const showDropdown =
    open && available && (status === 'ready' || status === 'empty' || status === 'error' || suggestions.length > 0)

  return (
    // 드롭다운은 이 래퍼 기준으로 absolute로 뜬다. 이 안이나 조상에 overflow-* 를 걸면
    // 목록이 통째로 잘려 "입력도 되고 요청도 200인데 목록만 안 보이는" 상태가 된다(실제로 겪음).
    // 스크롤이 필요하면 드롭다운 자신에게만 건다.
    <div className="relative w-full min-w-0">
      <Input
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      />

      {showDropdown && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {status === 'error' ? (
            <p className="px-3 py-2 text-xs text-destructive">장소 검색에 실패했습니다</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">검색 결과가 없습니다</p>
          ) : (
            <>
              <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <li
                    key={s.placeId}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    // onClick이면 input의 blur가 먼저 발생해 드롭다운이 사라지고 클릭이 씹힌다.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      select(s)
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'cursor-pointer px-3 py-2 text-xs',
                      i === activeIndex && 'bg-accent'
                    )}
                  >
                    <p className="truncate font-medium text-foreground">{s.mainText}</p>
                    {s.secondaryText && (
                      <p className="truncate text-muted-foreground">{s.secondaryText}</p>
                    )}
                  </li>
                ))}
              </ul>
              {/* 지도 없이 Places 데이터를 표시할 때는 Google 로고 표기가 의무다 (위젯은 이걸
                  자동으로 해줬다). 목록 바깥에 두고 스크롤해도 계속 보이게 한다. */}
              <div className="flex justify-end border-t bg-popover px-2 py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/powered-by-google.png"
                  srcSet="/powered-by-google.png 1x, /powered-by-google@2x.png 2x"
                  alt="Powered by Google"
                  width={120}
                  height={14}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
