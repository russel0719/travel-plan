'use client'

import { useTripStore } from '@/store/tripStore'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

// 데이터 로딩/동기화 실패를 사용자에게 드러내는 최소 배너.
// 예전엔 Supabase 오류를 콘솔에만 남기고 조용히 빈 화면으로 폴백해, 서버가 통째로 실패해도
// "데이터가 초기화된 것"처럼 보였다. 이 배너로 그런 무증상 실패를 즉시 알 수 있게 한다.
export default function SyncStatusBanner() {
  const loadError = useTripStore((s) => s.loadError)
  const syncError = useTripStore((s) => s.syncError)
  const message = loadError ?? syncError
  if (!message) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      <span className="min-w-0">{message}</span>
      <div className="flex items-center gap-1 shrink-0">
        {loadError && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              useTripStore.setState({ hydrated: false, loadError: null })
              useTripStore.getState().hydrate()
            }}
          >
            다시 시도
          </Button>
        )}
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="닫기"
          onClick={() => useTripStore.setState({ loadError: null, syncError: null })}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
