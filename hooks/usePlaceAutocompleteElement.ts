'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'

export interface SelectedPlace {
  name: string
  lat: number
  lng: number
  photoUrl?: string
  formattedAddress?: string
}

// Google Places Autocomplete 입력을 컨테이너 안에 붙인다.
// legacy google.maps.places.Autocomplete는 2025-03-01 이후 신규 고객 프로젝트에서는
// 콘솔 에러 없이 조용히 자동완성 요청 자체를 하지 않는 것으로 확인되어(실제 재현 완료),
// 신규 고객도 정상 동작하는 웹 컴포넌트 google.maps.places.PlaceAutocompleteElement를 사용한다.
// 이 컴포넌트는 Shadow DOM에 자체 입력창을 렌더링하는 비제어(uncontrolled) 엘리먼트라
// React state와는 이벤트(gmp-select/input)로만 동기화하고, 생성 후에는 React가 값을 되돌려쓰지 않는다.
//
// 컨테이너는 useRef+useEffect 조합이 아니라 콜백 ref로 관리한다 — Dialog가 열리는 시점에
// 컨테이너 div가 실제로 DOM에 붙는 타이밍(예: Base UI Dialog의 포털 마운트)과 useEffect 실행
// 시점이 어긋나면(처음엔 닫혀 있다가 나중에 열리는 실사용 패턴에서 실제로 발생) 위젯이 영영
// 생성되지 않는 버그가 있었다. 콜백 ref는 React가 노드를 실제로 붙이거나 뗄 때 정확히 호출되므로
// 이 경쟁 조건이 없다.
export function usePlaceAutocompleteElement(
  active: boolean,
  placeholder: string,
  initialValue: string,
  onSelect: (place: SelectedPlace) => void,
  onManualInput: (value: string) => void,
  extraFields: string[] = []
) {
  const placesLib = useMapsLibrary('places')
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const onSelectRef = useRef(onSelect)
  const onManualInputRef = useRef(onManualInput)
  useEffect(() => { onSelectRef.current = onSelect })
  useEffect(() => { onManualInputRef.current = onManualInput })

  const setContainer = useCallback((node: HTMLDivElement | null) => {
    cleanupRef.current?.()
    cleanupRef.current = null

    if (!node || !active || !placesLib) return

    const element = new google.maps.places.PlaceAutocompleteElement({})
    element.value = initialValue
    element.placeholder = placeholder
    // 이 커스텀 엘리먼트는 width:100%만 주면 내부 콘텐츠 기준의 intrinsic 너비(약 400px)를
    // 그대로 고집해 부모/뷰포트보다 넓게 렌더링된다(좁은 모바일 화면에서 다이얼로그 자체가
    // 화면 밖으로 밀려나는 원인이었음). display:block + max-width:100%로 명시적으로 눌러준다.
    //
    // 이때 컨테이너 div에 overflow-hidden을 걸어 오버플로를 막으려 하면 안 된다 — 데스크톱에서는
    // 제안 드롭다운이 컨테이너 기준 절대배치로 뜨기 때문에 통째로 잘려 "입력은 되고 Autocomplete
    // 요청도 200으로 나가는데 목록만 안 보이는" 상태가 된다(실제로 겪은 버그). 모바일 폭에서는
    // Google이 풀스크린 검색 UI로 전환해 증상이 안 나타나므로 모바일만 확인하면 놓친다.
    // 너비 제어는 반드시 위처럼 엘리먼트 쪽에서 한다.
    element.style.display = 'block'
    element.style.width = '100%'
    element.style.maxWidth = '100%'
    element.style.boxSizing = 'border-box'
    elementRef.current = element

    const handleSelect = (event: Event) => {
      const place = (event as google.maps.places.PlacePredictionSelectEvent).placePrediction.toPlace()
      place
        .fetchFields({ fields: ['displayName', 'location', 'photos', ...extraFields] })
        .then(() => {
          onSelectRef.current({
            name: place.displayName ?? '',
            lat: place.location?.lat() ?? 0,
            lng: place.location?.lng() ?? 0,
            photoUrl: place.photos?.[0]?.getURI({ maxWidth: 400 }),
            // formattedAddress는 fetchFields에 요청했을 때만 읽는다 — 요청하지 않은 필드의
            // getter에 접근하면 Places API가 에러를 던지기 때문에 무조건 읽으면 안 된다.
            formattedAddress: extraFields.includes('formattedAddress') ? place.formattedAddress ?? undefined : undefined,
          })
        })
        // 실패해도 폼은 그대로 열려 있어(사용자는 그냥 "선택이 안 먹었다"고만 느낌) 원인을 알 길이
        // 없으므로 최소한 콘솔에는 남긴다. Place Details 실패는 폼을 못 채울 뿐 치명적이진 않다.
        .catch((err) => console.error('Place Details(fetchFields) 실패:', err))
    }
    element.addEventListener('gmp-select', handleSelect)

    const handleInput = () => onManualInputRef.current(element.value)
    element.addEventListener('input', handleInput)

    // 이 위젯은 API 키 거부·Places API (New) 미활성화·과금 미설정 같은 실패를 gmp-error로만 알린다.
    // 듣지 않으면 "입력창은 뜨는데 제안이 영영 안 나오고 콘솔도 조용한" 무증상 상태가 된다.
    const handleError = (event: Event) => console.error('PlaceAutocompleteElement 오류:', event)
    element.addEventListener('gmp-error', handleError)

    node.appendChild(element)

    cleanupRef.current = () => {
      element.removeEventListener('gmp-select', handleSelect)
      element.removeEventListener('input', handleInput)
      element.removeEventListener('gmp-error', handleError)
      element.remove()
      elementRef.current = null
    }
    // initialValue/onSelect/onManualInput/extraFields는 의도적으로 제외 — 엘리먼트는 생성 시점에만
    // 초기값을 받고 이후로는 비제어로 동작한다(매 렌더마다 재생성하면 타이핑 중 포커스가 끊김).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, placesLib])

  // placeholder는 값이 바뀔 때 엘리먼트를 재생성하지 않고 속성만 갱신한다.
  useEffect(() => {
    if (elementRef.current) elementRef.current.placeholder = placeholder
  }, [placeholder])

  const setValue = useCallback((v: string) => {
    if (elementRef.current) elementRef.current.value = v
  }, [])

  return { containerRef: setContainer, setValue }
}
