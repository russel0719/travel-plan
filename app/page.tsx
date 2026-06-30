'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import { supabase } from '@/lib/supabase'
import TripCard from '@/components/trip/TripCard'
import CreateTripDialog from '@/components/trip/CreateTripDialog'
import LoginPage from '@/components/auth/LoginPage'
import { Button } from '@/components/ui/button'
import { Plus, Plane, FlaskConical, LogOut, ArrowUpDown } from 'lucide-react'
import { SAMPLE_TRIP } from '@/lib/sampleData'
import { Trip } from '@/lib/types'

type SortKey = 'updatedAt' | 'startDate' | 'title'

const SORT_LABELS: Record<SortKey, string> = {
  updatedAt: '최근 수정순',
  startDate: '여행 날짜순',
  title: '이름순',
}

function sortTrips(trips: Trip[], key: SortKey): Trip[] {
  return [...trips].sort((a, b) => {
    if (key === 'title') return a.title.localeCompare(b.title, 'ko')
    if (key === 'startDate') return b.startDate.localeCompare(a.startDate)
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export default function HomePage() {
  const router = useRouter()
  const { trips, hydrated, hydrate, userId, createTrip, deleteTrip } = useTripStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  const handleLoadSample = () => {
    const exists = trips.find((t) => t.id === SAMPLE_TRIP.id)
    if (exists) {
      router.push(`/trip/${SAMPLE_TRIP.id}`)
      return
    }
    useTripStore.setState((s) => ({ trips: [...s.trips, SAMPLE_TRIP] }))
    router.push(`/trip/${SAMPLE_TRIP.id}`)
  }

  const handleCreate = (data: Parameters<typeof createTrip>[0]) => {
    const trip = createTrip(data)
    setDialogOpen(false)
    router.push(`/trip/${trip.id}`)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('이 여행을 삭제하시겠습니까?')) deleteTrip(id)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    useTripStore.setState({ trips: [], hydrated: false, userId: null })
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3 text-muted-foreground">
          <Plane className="h-8 w-8 mx-auto animate-pulse" />
          <p className="text-sm">불러오는 중...</p>
        </div>
      </main>
    )
  }

  if (!userId) return <LoginPage />

  const sorted = sortTrips(trips, sortKey)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-xl p-2">
              <Plane className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">여행 플래너</h1>
              <p className="text-sm text-muted-foreground">나만의 여행 일정을 만들어보세요</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="md:hidden" onClick={handleLoadSample} title="샘플 보기">
              <FlaskConical className="h-4 w-4" />
            </Button>
            <Button size="icon" className="md:hidden" onClick={() => setDialogOpen(true)} title="새 여행">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="hidden md:inline-flex" onClick={handleLoadSample}>
              <FlaskConical className="h-4 w-4 mr-1.5" />샘플 보기
            </Button>
            <Button className="hidden md:inline-flex" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />새 여행
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="로그아웃">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="text-6xl">✈️</div>
            <p className="text-muted-foreground">아직 여행이 없습니다</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleLoadSample}>
                <FlaskConical className="h-4 w-4 mr-1.5" />
                샘플 여행 보기
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                첫 여행 만들기
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">총 {trips.length}개의 여행</p>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => setSortMenuOpen((v) => !v)}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {SORT_LABELS[sortKey]}
                </Button>
                {sortMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setSortMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-white border rounded-lg shadow-md py-1 min-w-[130px]">
                      {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                        <button
                          key={key}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                            sortKey === key ? 'font-semibold text-primary' : ''
                          }`}
                          onClick={() => { setSortKey(key); setSortMenuOpen(false) }}
                        >
                          {SORT_LABELS[key]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onClick={() => router.push(`/trip/${trip.id}`)}
                  onDelete={(e) => handleDelete(e, trip.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <CreateTripDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </main>
  )
}
