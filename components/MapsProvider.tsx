'use client'

import { APIProvider } from '@vis.gl/react-google-maps'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export default function MapsProvider({ children }: { children: React.ReactNode }) {
  if (!API_KEY) {
    if (typeof window !== 'undefined') {
      console.warn('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 설정되지 않아 Google Maps/장소 검색 기능이 비활성화됩니다.')
    }
    return <>{children}</>
  }
  return (
    <APIProvider apiKey={API_KEY} libraries={['places', 'geometry']}>
      {children}
    </APIProvider>
  )
}
