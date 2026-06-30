'use client'

import { APIProvider } from '@vis.gl/react-google-maps'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export default function MapsProvider({ children }: { children: React.ReactNode }) {
  if (!API_KEY) return <>{children}</>
  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      {children}
    </APIProvider>
  )
}
