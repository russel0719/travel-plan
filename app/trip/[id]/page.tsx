'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import TripHeader from '@/components/trip/TripHeader'
import DaySchedule from '@/components/trip/DaySchedule'
import FlightSection from '@/components/trip/FlightSection'
import AccommodationSection from '@/components/trip/AccommodationSection'
import BudgetTracker from '@/components/trip/BudgetTracker'
import TripMap from '@/components/map/TripMap'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getDayLabel } from '@/lib/utils'
import { ScheduleItem, Trip, Budget, Flight, Accommodation } from '@/lib/types'
import { CalendarDays, Plane, Wallet } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function TripPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const {
    hydrated, hydrate, getTrip,
    updateTrip, addScheduleItem, updateScheduleItem, deleteScheduleItem, reorderScheduleItems,
    addFlight, updateFlight, deleteFlight,
    addAccommodation, updateAccommodation, deleteAccommodation,
    updateBudget,
  } = useTripStore()
  const [activeDay, setActiveDay] = useState(0)
  const [panel, setPanel] = useState<'schedule' | 'info' | 'budget'>('schedule')

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  const trip = getTrip(id)

  useEffect(() => {
    if (hydrated && !trip) router.push('/')
  }, [hydrated, trip, router])

  if (!hydrated || !trip) return null

  const currentDay = trip.days[activeDay]

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TripHeader trip={trip} onUpdate={(data) => updateTrip(id, data as Partial<Trip>)} />

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 패널 */}
        <div className="w-full max-w-sm border-r bg-gray-50 flex flex-col overflow-hidden">

          {/* 패널 전환 탭 */}
          <div className="border-b bg-white px-3 pt-2 pb-1 flex gap-1">
            <button
              onClick={() => setPanel('schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                panel === 'schedule' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />일정
            </button>
            {trip.isInternational && (
              <button
                onClick={() => setPanel('info')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  panel === 'info' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Plane className="h-3.5 w-3.5" />항공·숙박
              </button>
            )}
            <button
              onClick={() => setPanel('budget')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                panel === 'budget' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />예산
            </button>
          </div>

          {/* 일정 패널 */}
          {panel === 'schedule' && (
            <Tabs
              value={String(activeDay)}
              onValueChange={(v) => setActiveDay(Number(v))}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="border-b bg-white px-3 pt-2">
                <TabsList className="flex gap-1 h-auto flex-wrap bg-transparent p-0 pb-2">
                  {trip.days.map((_, idx) => (
                    <TabsTrigger
                      key={idx}
                      value={String(idx)}
                      className="text-xs px-2.5 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md"
                    >
                      {getDayLabel(idx)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="flex-1 overflow-y-auto">
                {trip.days.map((day, idx) => (
                  <TabsContent key={idx} value={String(idx)} className="p-3 mt-0">
                    <DaySchedule
                      day={day}
                      onAddItem={(item) => addScheduleItem(id, day.date, item)}
                      onUpdateItem={(itemId, data) => updateScheduleItem(id, day.date, itemId, data)}
                      onDeleteItem={(itemId) => deleteScheduleItem(id, day.date, itemId)}
                      onReorderItems={(items: ScheduleItem[]) => reorderScheduleItems(id, day.date, items)}
                    />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}

          {/* 항공·숙박 패널 */}
          {panel === 'info' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-6">
              <FlightSection
                flights={trip.flights ?? []}
                onAdd={(f: Omit<Flight, 'id'>) => addFlight(id, f)}
                onUpdate={(fid: string, f: Partial<Flight>) => updateFlight(id, fid, f)}
                onDelete={(fid: string) => deleteFlight(id, fid)}
              />
              <AccommodationSection
                accommodations={trip.accommodations ?? []}
                onAdd={(a: Omit<Accommodation, 'id'>) => addAccommodation(id, a)}
                onUpdate={(aid: string, a: Partial<Accommodation>) => updateAccommodation(id, aid, a)}
                onDelete={(aid: string) => deleteAccommodation(id, aid)}
              />
            </div>
          )}

          {/* 예산 패널 */}
          {panel === 'budget' && (
            <div className="flex-1 overflow-y-auto p-3">
              <BudgetTracker
                trip={trip}
                onUpdateBudget={(b: Budget) => updateBudget(id, b)}
              />
            </div>
          )}
        </div>

        {/* 우측: 지도 */}
        <div className="flex-1 p-3">
          {currentDay && <TripMap day={currentDay} />}
        </div>
      </div>
    </div>
  )
}
