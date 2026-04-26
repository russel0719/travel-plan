'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import TripCard from '@/components/trip/TripCard'
import CreateTripDialog from '@/components/trip/CreateTripDialog'
import { Button } from '@/components/ui/button'
import { Plus, Plane, FlaskConical } from 'lucide-react'
import { SAMPLE_TRIP } from '@/lib/sampleData'

export default function HomePage() {
  const router = useRouter()
  const { trips, hydrated, hydrate, createTrip, deleteTrip } = useTripStore()
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleLoadSample = () => {
    const exists = trips.find((t) => t.id === SAMPLE_TRIP.id)
    if (exists) {
      router.push(`/trip/${SAMPLE_TRIP.id}`)
      return
    }
    useTripStore.setState((s) => ({ trips: [...s.trips, SAMPLE_TRIP] }))
    router.push(`/trip/${SAMPLE_TRIP.id}`)
  }

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  const handleCreate = (data: Parameters<typeof createTrip>[0]) => {
    const trip = createTrip(data)
    setDialogOpen(false)
    router.push(`/trip/${trip.id}`)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('이 여행을 삭제하시겠습니까?')) deleteTrip(id)
  }

  if (!hydrated) return null

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
            <Button variant="outline" onClick={handleLoadSample}>
              <FlaskConical className="h-4 w-4 mr-1.5" />
              샘플 보기
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              새 여행
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onClick={() => router.push(`/trip/${trip.id}`)}
                onDelete={(e) => handleDelete(e, trip.id)}
              />
            ))}
          </div>
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
