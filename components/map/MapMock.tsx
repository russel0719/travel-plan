'use client'

import { MapPin } from 'lucide-react'

export default function MapMock() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-muted/30 rounded-lg border border-dashed gap-3">
      <MapPin className="h-10 w-10 text-muted-foreground/50" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-muted-foreground">지도를 표시하려면 API 키가 필요합니다</p>
        <p className="text-xs text-muted-foreground/70">
          .env.local에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 추가하세요
        </p>
      </div>
    </div>
  )
}
