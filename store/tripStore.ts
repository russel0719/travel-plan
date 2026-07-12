import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { Trip, DaySchedule, ScheduleItem, Flight, Accommodation, Budget, TravelReport } from '@/lib/types'
import { loadTrips, upsertTrip, removeTrip, getLocalTrips, clearLocalTrips } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { generateId, getDaysBetween } from '@/lib/utils'

interface TripStore {
  trips: Trip[]
  hydrated: boolean
  userId: string | null
  loadError: string | null
  syncError: string | null
  hydrate: () => Promise<void>
  createTrip: (data: { title: string; destination: string; startDate: string; endDate: string; isInternational: boolean }) => Trip
  updateTrip: (id: string, data: Partial<Omit<Trip, 'id' | 'createdAt'>>) => void
  deleteTrip: (id: string) => void
  getTrip: (id: string) => Trip | undefined
  addScheduleItem: (tripId: string, date: string, item: Omit<ScheduleItem, 'id'>) => void
  updateScheduleItem: (tripId: string, date: string, itemId: string, data: Partial<ScheduleItem>) => void
  deleteScheduleItem: (tripId: string, date: string, itemId: string) => void
  reorderScheduleItems: (tripId: string, date: string, items: ScheduleItem[]) => void
  addFlight: (tripId: string, flight: Omit<Flight, 'id'>) => void
  updateFlight: (tripId: string, flightId: string, data: Partial<Flight>) => void
  deleteFlight: (tripId: string, flightId: string) => void
  addAccommodation: (tripId: string, acc: Omit<Accommodation, 'id'>) => void
  updateAccommodation: (tripId: string, accId: string, data: Partial<Accommodation>) => void
  deleteAccommodation: (tripId: string, accId: string) => void
  updateBudget: (tripId: string, budget: Budget) => void
  addReport: (tripId: string, report: Omit<TravelReport, 'id' | 'createdAt'>, presetId?: string) => TravelReport
  updateReport: (tripId: string, reportId: string, data: Partial<TravelReport>) => void
  deleteReport: (tripId: string, reportId: string) => void
}

const touch = (t: Trip): Trip => ({ ...t, updatedAt: new Date().toISOString() })

// subscribe에서 변경 감지용 — hydrate 시 초기화
let previousTrips: Trip[] = []
let hydrating = false

export const useTripStore = create<TripStore>()(
  subscribeWithSelector((set, get) => ({
    trips: [],
    hydrated: false,
    userId: null,
    loadError: null,
    syncError: null,

    hydrate: async () => {
      if (hydrating || useTripStore.getState().hydrated) return
      hydrating = true
      previousTrips = []

      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          set({ trips: [], hydrated: true, userId: null })
          return
        }

        // AUTH.md: app_id, role 메타데이터 미설정 시 동기화
        const meta = user.user_metadata ?? {}
        if (meta.app_id !== 'travel_plan' || meta.role !== 'user') {
          await supabase.auth.updateUser({
            data: { app_id: 'travel_plan', role: 'user' },
          })
        }

        // 첫 로그인 시 localStorage 데이터 자동 이전 — 원격 저장이 "전부" 성공했을 때만
        // 로컬 백업을 지운다. (예전에는 upsert 실패 여부와 무관하게 무조건 clearLocalTrips()를
        // 호출해, 서버 저장이 실패해도 로컬 백업까지 사라져 데이터가 유실될 수 있었다.)
        const localTrips = getLocalTrips()
        if (localTrips.length > 0) {
          const results = await Promise.allSettled(localTrips.map((t) => upsertTrip(t, user.id)))
          const allOk = results.every((r) => r.status === 'fulfilled' && r.value.ok)
          if (allOk) {
            clearLocalTrips()
          } else {
            set({ syncError: '이 기기에 저장된 여행 일부를 서버로 옮기지 못했습니다. 데이터는 기기에 그대로 보관되어 있습니다.' })
          }
        }

        const { trips, error } = await loadTrips(user.id)
        previousTrips = [...trips]
        set({ trips, hydrated: true, userId: user.id, loadError: error })
      } finally {
        hydrating = false
      }
    },

    createTrip: (data) => {
      const dates = getDaysBetween(data.startDate, data.endDate)
      const days: DaySchedule[] = dates.map((date) => ({ date, items: [] }))
      const trip: Trip = {
        id: generateId(),
        ...data,
        days,
        flights: [],
        accommodations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      set((state) => ({ trips: [...state.trips, trip] }))
      return trip
    },

    updateTrip: (id, data) => {
      set((state) => ({
        trips: state.trips.map((t) => t.id === id ? touch({ ...t, ...data }) : t),
      }))
    },

    deleteTrip: (id) => {
      set((state) => ({ trips: state.trips.filter((t) => t.id !== id) }))
    },

    getTrip: (id) => get().trips.find((t) => t.id === id),

    addScheduleItem: (tripId, date, item) => {
      set((state) => ({
        trips: state.trips.map((t) => {
          if (t.id !== tripId) return t
          return touch({
            ...t,
            days: t.days.map((d) =>
              d.date !== date ? d : { ...d, items: [...d.items, { ...item, id: generateId() }] }
            ),
          })
        }),
      }))
    },

    updateScheduleItem: (tripId, date, itemId, data) => {
      set((state) => ({
        trips: state.trips.map((t) => {
          if (t.id !== tripId) return t
          return touch({
            ...t,
            days: t.days.map((d) =>
              d.date !== date ? d : {
                ...d,
                items: d.items.map((item) => item.id === itemId ? { ...item, ...data } : item),
              }
            ),
          })
        }),
      }))
    },

    deleteScheduleItem: (tripId, date, itemId) => {
      set((state) => ({
        trips: state.trips.map((t) => {
          if (t.id !== tripId) return t
          return touch({
            ...t,
            days: t.days.map((d) =>
              d.date !== date ? d : { ...d, items: d.items.filter((item) => item.id !== itemId) }
            ),
          })
        }),
      }))
    },

    reorderScheduleItems: (tripId, date, items) => {
      set((state) => ({
        trips: state.trips.map((t) => {
          if (t.id !== tripId) return t
          return touch({ ...t, days: t.days.map((d) => (d.date === date ? { ...d, items } : d)) })
        }),
      }))
    },

    addFlight: (tripId, flight) => {
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({ ...t, flights: [...(t.flights ?? []), { ...flight, id: generateId() }] })
        ),
      }))
    },

    updateFlight: (tripId, flightId, data) => {
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({
            ...t,
            flights: (t.flights ?? []).map((f) => f.id === flightId ? { ...f, ...data } : f),
          })
        ),
      }))
    },

    deleteFlight: (tripId, flightId) => {
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({ ...t, flights: (t.flights ?? []).filter((f) => f.id !== flightId) })
        ),
      }))
    },

    addAccommodation: (tripId, acc) => {
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({ ...t, accommodations: [...(t.accommodations ?? []), { ...acc, id: generateId() }] })
        ),
      }))
    },

    updateAccommodation: (tripId, accId, data) => {
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({
            ...t,
            accommodations: (t.accommodations ?? []).map((a) => a.id === accId ? { ...a, ...data } : a),
          })
        ),
      }))
    },

    deleteAccommodation: (tripId, accId) => {
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({ ...t, accommodations: (t.accommodations ?? []).filter((a) => a.id !== accId) })
        ),
      }))
    },

    updateBudget: (tripId, budget) => {
      set((state) => ({
        trips: state.trips.map((t) => t.id !== tripId ? t : touch({ ...t, budget })),
      }))
    },

    addReport: (tripId, reportData, presetId) => {
      const report: TravelReport = {
        ...reportData,
        id: presetId ?? generateId(),
        createdAt: new Date().toISOString(),
      }
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({ ...t, reports: [...(t.reports ?? []), report] })
        ),
      }))
      return report
    },

    updateReport: (tripId, reportId, data) => {
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({
            ...t,
            reports: (t.reports ?? []).map((r) => r.id === reportId ? { ...r, ...data } : r),
          })
        ),
      }))
    },

    deleteReport: (tripId, reportId) => {
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({ ...t, reports: (t.reports ?? []).filter((r) => r.id !== reportId) })
        ),
      }))
    },
  }))
)

// trips 변경 감지 → 변경된 trip만 Supabase에 upsert/delete
useTripStore.subscribe(
  (state) => state.trips,
  (trips) => {
    const { hydrated, userId } = useTripStore.getState()
    if (!hydrated || !userId) return

    const changed = trips.filter((t) => {
      const prev = previousTrips.find((p) => p.id === t.id)
      return !prev || prev.updatedAt !== t.updatedAt
    })

    const deletedIds = previousTrips
      .filter((p) => !trips.find((t) => t.id === p.id))
      .map((p) => p.id)

    previousTrips = [...trips]

    changed.forEach((trip) => {
      upsertTrip(trip, userId).then((r) => {
        if (!r.ok) useTripStore.setState({ syncError: `"${trip.title}" 저장에 실패했습니다: ${r.error}` })
      })
    })
    deletedIds.forEach((id) => {
      removeTrip(id).then((r) => {
        if (!r.ok) useTripStore.setState({ syncError: `삭제에 실패했습니다: ${r.error}` })
      })
    })
  }
)
