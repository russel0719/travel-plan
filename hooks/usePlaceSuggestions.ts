'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'

export type SuggestionStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export interface PlaceSuggestion {
  placeId: string
  mainText: string
  secondaryText: string
  prediction: google.maps.places.PlacePrediction
}

const DEBOUNCE_MS = 250
// 1글자로는 쓸만한 제안이 안 나오는데 요청만 나간다.
const MIN_QUERY_LENGTH = 2
// 파생 반환값의 참조를 고정해 호출부가 불필요하게 리렌더되지 않게 한다.
const NO_SUGGESTIONS: PlaceSuggestion[] = []

// Google의 PlaceAutocompleteElement 위젯 대신 Autocomplete Data API로 제안만 받아온다.
// 위젯은 좁은 화면에서 제안 목록을 풀스크린 <dialog>로 띄우는데, 그 dialog가 closed shadow DOM
// 안에 있고 part 속성도 없어서 CSS로 크기를 바꿀 방법이 전혀 없다(실측 확인). 목록을 우리 DOM으로
// 가져오는 것이 유일한 해결책이었고, 덤으로 스타일·키보드·에러 표시를 전부 직접 통제하게 됐다.
export function usePlaceSuggestions(query: string, locationBias?: google.maps.LatLngLiteral) {
  const placesLib = useMapsLibrary('places')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [status, setStatus] = useState<SuggestionStatus>('idle')

  // 세션 토큰의 수명이 곧 과금 단위다. 타이핑 시작부터 선택(fetchFields)까지 하나를 재사용해야
  // 세션 단위로 과금되고, 토큰이 없거나 재사용을 놓치면 요청이 건건이 과금된다.
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  // fetchAutocompleteSuggestions는 AbortController를 받지 않아 요청 취소가 불가능하다.
  // 디바운스만으로는 느린 "도" 응답이 빠른 "도쿄타워" 응답 뒤에 도착해 목록을 되돌리는 걸 못 막는다.
  const requestIdRef = useRef(0)

  // 선택이 끝나면(성공/실패 무관) 세션을 닫는다. 실패했다고 토큰을 살려두면 이미 소비된 토큰을
  // 계속 재사용해 이후 요청이 전부 건당 과금된다.
  const endSession = useCallback(() => {
    tokenRef.current = null
  }, [])

  // 객체를 그대로 deps에 넣으면 렌더마다 새 참조라 effect가 무한히 돈다.
  const biasKey = locationBias ? `${locationBias.lat},${locationBias.lng}` : ''

  const q = query.trim()
  // 검색할 수 있는 상태인가. 짧은 쿼리의 빈 목록은 상태로 두지 않고 아래 반환에서 파생시킨다
  // (effect에서 곧바로 setState하면 불필요한 렌더가 한 번 더 돈다).
  const searchable = !!placesLib && q.length >= MIN_QUERY_LENGTH

  useEffect(() => {
    if (!searchable) {
      // 입력을 비웠다 = 새 검색이다. 다이얼로그가 닫히지 않고 재사용되는 경우(추가 폼은 항상
      // 마운트된 채 open만 토글된다)에도 세션이 넘어가지 않도록 하는 안전망.
      if (q.length === 0) endSession()
      return
    }

    const requestId = ++requestIdRef.current

    const timer = setTimeout(async () => {
      // 이미 목록이 떠 있으면 유지한 채로 갱신한다 — 매 키스트로크마다 비우면 심하게 깜빡인다.
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'))
      try {
        if (!tokenRef.current) tokenRef.current = new google.maps.places.AutocompleteSessionToken()

        const { suggestions: raw } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: tokenRef.current,
          ...(locationBias ? { locationBias } : {}),
        })
        if (requestId !== requestIdRef.current) return

        const list = raw
          .map((s) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => p != null)
          .map((p) => ({
            placeId: p.placeId,
            mainText: p.mainText?.text ?? p.text.text,
            secondaryText: p.secondaryText?.text ?? '',
            prediction: p,
          }))

        setSuggestions(list)
        setStatus(list.length ? 'ready' : 'empty')
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        // 위젯 시절엔 이런 실패가 콘솔에도 안 남아 원인을 찾을 수 없었다. 이제 UI로 보여준다.
        console.error('장소 검색 실패:', err)
        setSuggestions([])
        setStatus('error')
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, searchable, biasKey, endSession])

  return {
    // 쿼리가 짧아지면 직전 검색 결과가 남아 보이지 않도록 파생 단계에서 잘라낸다.
    suggestions: searchable ? suggestions : NO_SUGGESTIONS,
    status: searchable ? status : 'idle',
    // API 키가 없으면 MapsProvider가 APIProvider를 씌우지 않아 places 라이브러리가 영영 null이다.
    // 그때는 호출부가 평범한 텍스트 입력으로 degrade한다.
    available: !!placesLib,
    endSession,
  }
}
