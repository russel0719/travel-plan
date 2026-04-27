'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import TripHeader from '@/components/trip/TripHeader'
import ReportCommentPanel from '@/components/report/ReportCommentPanel'
import { Trip } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string; reportId: string }>
}

export default function ReportDetailPage({ params }: PageProps) {
  const { id: tripId, reportId } = use(params)
  const router = useRouter()
  const { hydrated, hydrate, getTrip, updateTrip } = useTripStore()

  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])

  const trip = getTrip(tripId)

  useEffect(() => {
    if (hydrated && !trip) router.push('/')
  }, [hydrated, trip, router])

  if (!hydrated || !trip) return null

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <TripHeader trip={trip} onUpdate={(data) => updateTrip(tripId, data as Partial<Trip>)} />
      <div className="flex flex-1 overflow-hidden">
        <ReportCommentPanel
          tripId={tripId}
          reportId={reportId}
          onPrint={() => router.push(`/trip/${tripId}/report/${reportId}/print`)}
          onBack={() => router.push(`/trip/${tripId}`)}
        />
      </div>
    </div>
  )
}
