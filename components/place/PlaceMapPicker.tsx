'use client'

import { Map, AdvancedMarker, Pin, MapMouseEvent } from '@vis.gl/react-google-maps'
import { fetchSelectedPlace, SelectedPlace } from '@/lib/places'

interface PlaceMapPickerProps {
  /** 이미 고른 지점이 있으면 마커로 표시하고 이 좌표를 중심으로 연다 */
  selected?: { lat: number; lng: number }
  /** selected가 없을 때 지도를 열 기준점 (예: 그 날 묵는 숙소) */
  fallbackCenter?: google.maps.LatLngLiteral
  onSelect: (place: SelectedPlace) => void
  /** POI가 아닌 빈 공간을 찍은 경우 — 이름 없이 좌표만 얻는다 */
  onPickCoords: (lat: number, lng: number) => void
  extraFields?: string[]
}

// 도쿄 — TripMap의 폴백과 동일
const DEFAULT_CENTER = { lat: 35.6762, lng: 139.6503 }

// 지도에서 한 지점을 고르기 위한 작은 지도. TripMap과 합치지 않는다 — 저쪽은 "여러 일정과
// 경로를 보여주기", 이쪽은 "한 지점 고르기"로 관심사가 다르고, 모드 플래그로 묶으면 양쪽 다
// 복잡해진다.
export default function PlaceMapPicker({
  selected,
  fallbackCenter,
  onSelect,
  onPickCoords,
  extraFields,
}: PlaceMapPickerProps) {
  const center = selected ?? fallbackCenter ?? DEFAULT_CENTER

  const handleClick = (e: MapMouseEvent) => {
    // POI를 탭하면 Google 기본 인포윈도우가 뜬다. clickableIcons를 끄면 POI 클릭 이벤트 자체가
    // 안 오므로, 이벤트는 받되 기본 팝업만 막는다.
    if (e.stoppable) e.stop()

    const { placeId, latLng } = e.detail
    if (!latLng) return

    if (placeId) {
      fetchSelectedPlace(new google.maps.places.Place({ id: placeId }), extraFields)
        .then(onSelect)
        .catch((err) => {
          console.error('지도에서 고른 장소의 정보를 가져오지 못했습니다:', err)
          onPickCoords(latLng.lat, latLng.lng)
        })
    } else {
      onPickCoords(latLng.lat, latLng.lng)
    }
  }

  return (
    <Map
      mapId="travel-plan-map"
      defaultCenter={center}
      defaultZoom={15}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      onClick={handleClick}
      className="h-44 w-full rounded-lg"
    >
      {selected && (
        <AdvancedMarker position={selected}>
          <Pin background="#ef4444" borderColor="#fff" glyphColor="#fff" />
        </AdvancedMarker>
      )}
    </Map>
  )
}
