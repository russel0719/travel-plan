export interface SelectedPlace {
  name: string
  lat: number
  lng: number
  photoUrl?: string
  formattedAddress?: string
}

// 자동완성 제안이든 지도에서 클릭한 POI든 결국 Place 하나로 수렴한다 —
// 전자는 prediction.toPlace(), 후자는 new Place({ id: placeId }). 그 뒤 처리는 같으므로
// 여기 한 곳에만 둔다.
//
// 주의: fetchFields에 요청하지 않은 필드의 getter에 접근하면 Places API가 에러를 던진다.
// 그래서 formattedAddress는 호출부가 extraFields로 요청했을 때만 읽는다.
export async function fetchSelectedPlace(
  place: google.maps.places.Place,
  extraFields: string[] = []
): Promise<SelectedPlace> {
  await place.fetchFields({ fields: ['displayName', 'location', 'photos', ...extraFields] })
  return {
    name: place.displayName ?? '',
    lat: place.location?.lat() ?? 0,
    lng: place.location?.lng() ?? 0,
    photoUrl: place.photos?.[0]?.getURI({ maxWidth: 400 }),
    formattedAddress: extraFields.includes('formattedAddress') ? place.formattedAddress ?? undefined : undefined,
  }
}
