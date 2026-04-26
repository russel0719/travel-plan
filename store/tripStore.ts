import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { Trip, DaySchedule, ScheduleItem, Flight, Accommodation, Budget } from '@/lib/types'
import { loadTrips, saveTrips } from '@/lib/storage'
import { generateId, getDaysBetween } from '@/lib/utils'

interface TripStore {
  trips: Trip[]
  hydrated: boolean
  hydrate: () => void
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
}

const touch = (t: Trip): Trip => ({ ...t, updatedAt: new Date().toISOString() })

export const useTripStore = create<TripStore>()(
  subscribeWithSelector((set, get) => ({
    trips: [],
    hydrated: false,

    hydrate: () => {
      const trips = loadTrips()
      set({ trips, hydrated: true })
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
        trips: state.trips.map((t) =>
          t.id === id ? touch({ ...t, ...data }) : t
        ),
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
        trips: state.trips.map((t) =>
          t.id !== tripId ? t : touch({ ...t, budget })
        ),
      }))
    },
  }))
)

useTripStore.subscribe(
  (state) => state.trips,
  (trips) => {
    if (useTripStore.getState().hydrated) {
      saveTrips(trips)
    }
  }
)
