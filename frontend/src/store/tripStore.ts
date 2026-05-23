import { create } from "zustand"
import type { TripMetadata, TripPlan, TripPreferences, UserEdit } from "../types/trip"

const sanitizeActivities = (activities: unknown) => {
  if (!Array.isArray(activities)) {
    return []
  }

  return activities
    .filter((activity): activity is string => typeof activity === "string")
    .map((activity) => activity.trim())
    .filter(Boolean)
}

const sanitizeTripPayload = (trip: TripPlan | null): TripPlan | null => {
  if (!trip) {
    return null
  }

  const rawTrip = trip as Partial<TripPlan> & {
    budget_breakdown?: {
      category_totals?: unknown
      day_breakdown?: unknown
      notes?: unknown
      currency?: unknown
    }
  }

  const itinerary = Array.isArray(rawTrip.itinerary)
    ? rawTrip.itinerary.map((day, index) => {
        const safeDayNumber = typeof day?.day === "number" ? day.day : index + 1
        const safeTitle = typeof day?.title === "string" && day.title.trim()
          ? day.title.trim()
          : `Day ${safeDayNumber}`

        return {
          day: safeDayNumber,
          title: safeTitle,
          activities: sanitizeActivities(day?.activities),
        }
      })
    : []

  const rawBudget = rawTrip.budget_breakdown
  const budget_breakdown = rawBudget && typeof rawBudget === "object"
    ? {
        currency: typeof rawBudget.currency === "string" && rawBudget.currency.trim()
          ? rawBudget.currency
          : "INR",
        category_totals: Array.isArray(rawBudget.category_totals)
          ? rawBudget.category_totals.filter((item) => item && typeof item === "object")
          : [],
        day_breakdown: Array.isArray(rawBudget.day_breakdown)
          ? rawBudget.day_breakdown
              .filter((item) => item && typeof item === "object")
              .map((dayBudget) => {
                const rawItems = (dayBudget as { items?: unknown }).items
                return {
                  ...dayBudget,
                  items: Array.isArray(rawItems)
                    ? rawItems.filter((item) => item && typeof item === "object")
                    : [],
                }
              })
          : [],
        notes: typeof rawBudget.notes === "string" ? rawBudget.notes : "",
      }
    : undefined

  return {
    destination: typeof rawTrip.destination === "string" ? rawTrip.destination : "",
    total_budget: typeof rawTrip.total_budget === "number" ? rawTrip.total_budget : 0,
    itinerary,
    ...(budget_breakdown ? { budget_breakdown } : {}),
  }
}

interface TripStore {
  startLocation: string
  destination: string
  transportationMode: string
  budget: number | null
  days: number | null
  interests: string[]

  trip: TripPlan | null
  loading: boolean
  aiSuggestions: string[]
  selectedActivities: string[]
  pinnedActivities: string[]
  streamingStatus: string | null
  streamMessages: string[]
  tripMetadata: TripMetadata
  userEdits: UserEdit[]
  suppressAutoReplanUntil: number

  updatePreferences: (updates: Partial<TripPreferences>) => void
  setTrip: (trip: TripPlan | null) => void
  setLoading: (loading: boolean) => void
  setAiSuggestions: (suggestions: string[]) => void
  setSelectedActivities: (activities: string[]) => void
  toggleSelectedActivity: (activity: string) => void
  setStreamingStatus: (status: string | null) => void
  appendStreamMessage: (message: string) => void
  clearStreamMessages: () => void
  togglePinnedActivity: (day: number, activity: string) => void
  deleteActivity: (day: number, activityIndex: number) => void
  editActivity: (day: number, activityIndex: number, nextValue: string) => void
  addUserEdit: (edit: UserEdit) => void
  setTripMetadata: (updates: Partial<TripMetadata>) => void
  suppressAutoReplanFor: (milliseconds: number) => void
  resetPlanner: () => void
}

export const useTripStore = create<TripStore>((set) => ({
  startLocation: "",
  destination: "",
  transportationMode: "",
  budget: null,
  days: null,
  interests: [],

  trip: null,
  loading: false,
  aiSuggestions: [],
  selectedActivities: [],
  pinnedActivities: [],
  streamingStatus: null,
  streamMessages: [],
  tripMetadata: {
    lastGeneratedAt: null,
    requestCount: 0,
    error: null,
  },
  userEdits: [],
  suppressAutoReplanUntil: 0,

  updatePreferences: (updates) => set(updates),
  setTrip: (trip) => set({
    trip: sanitizeTripPayload(trip),
    selectedActivities: [],
    pinnedActivities: [],
    userEdits: [],
  }),
  setLoading: (loading) => set({ loading }),
  setAiSuggestions: (aiSuggestions) => set({ aiSuggestions }),
  setSelectedActivities: (selectedActivities) => set({ selectedActivities }),
  setStreamingStatus: (streamingStatus) => set({ streamingStatus }),
  appendStreamMessage: (message) =>
    set((state) => ({ streamMessages: [...state.streamMessages, message] })),
  clearStreamMessages: () => set({ streamMessages: [] }),
  toggleSelectedActivity: (activity) =>
    set((state) => ({
      selectedActivities: state.selectedActivities.includes(activity)
        ? state.selectedActivities.filter((item) => item !== activity)
        : [...state.selectedActivities, activity],
    })),
  togglePinnedActivity: (day, activity) =>
    set((state) => {
      const activityKey = `${day}:${activity}`
      const isPinned = state.pinnedActivities.includes(activityKey)

      return {
        pinnedActivities: isPinned
          ? state.pinnedActivities.filter((item) => item !== activityKey)
          : [...state.pinnedActivities, activityKey],
        userEdits: [
          ...state.userEdits,
          {
            id: `${Date.now()}-${Math.random()}`,
            action: isPinned ? "unpin" : "pin",
            day,
            previousValue: activity,
            nextValue: activity,
            updatedAt: new Date().toISOString(),
          },
        ],
      }
    }),
  deleteActivity: (day, activityIndex) =>
    set((state) => {
      if (!state.trip) {
        return state
      }

      const dayIndex = state.trip.itinerary.findIndex((item) => item.day === day)
      if (dayIndex < 0) {
        return state
      }

      const targetDay = state.trip.itinerary[dayIndex]
      const previousValue = targetDay.activities[activityIndex]
      if (!previousValue) {
        return state
      }

      const updatedActivities = targetDay.activities.filter((_, index) => index !== activityIndex)
      const updatedItinerary = state.trip.itinerary.map((item, index) =>
        index === dayIndex
          ? { ...item, activities: updatedActivities }
          : item
      )
      const activityKey = `${day}:${previousValue}`

      return {
        trip: {
          ...state.trip,
          itinerary: updatedItinerary,
        },
        aiSuggestions: state.aiSuggestions.filter((item) => item !== previousValue),
        selectedActivities: state.selectedActivities.filter((item) => item !== activityKey),
        pinnedActivities: state.pinnedActivities.filter((item) => item !== activityKey),
        userEdits: [
          ...state.userEdits,
          {
            id: `${Date.now()}-${Math.random()}`,
            action: "delete",
            day,
            previousValue,
            nextValue: "",
            updatedAt: new Date().toISOString(),
          },
        ],
      }
    }),
  editActivity: (day, activityIndex, nextValue) =>
    set((state) => {
      if (!state.trip) {
        return state
      }

      const cleanedNextValue = nextValue.trim()
      if (!cleanedNextValue) {
        return state
      }

      const dayIndex = state.trip.itinerary.findIndex((item) => item.day === day)
      if (dayIndex < 0) {
        return state
      }

      const targetDay = state.trip.itinerary[dayIndex]
      const previousValue = targetDay.activities[activityIndex]
      if (!previousValue || previousValue === cleanedNextValue) {
        return state
      }

      const updatedActivities = targetDay.activities.map((item, index) =>
        index === activityIndex ? cleanedNextValue : item
      )
      const updatedItinerary = state.trip.itinerary.map((item, index) =>
        index === dayIndex
          ? { ...item, activities: updatedActivities }
          : item
      )

      const previousKey = `${day}:${previousValue}`
      const nextKey = `${day}:${cleanedNextValue}`

      return {
        trip: {
          ...state.trip,
          itinerary: updatedItinerary,
        },
        aiSuggestions: state.aiSuggestions.map((item) =>
          item === previousValue ? cleanedNextValue : item
        ),
        selectedActivities: state.selectedActivities.map((item) =>
          item === previousKey ? nextKey : item
        ),
        pinnedActivities: state.pinnedActivities.map((item) =>
          item === previousKey ? nextKey : item
        ),
        userEdits: [
          ...state.userEdits,
          {
            id: `${Date.now()}-${Math.random()}`,
            action: "edit",
            day,
            previousValue,
            nextValue: cleanedNextValue,
            updatedAt: new Date().toISOString(),
          },
        ],
      }
    }),
  addUserEdit: (edit) => set((state) => ({ userEdits: [...state.userEdits, edit] })),
  setTripMetadata: (updates) =>
    set((state) => ({
      tripMetadata: { ...state.tripMetadata, ...updates },
    })),
  suppressAutoReplanFor: (milliseconds) =>
    set({
      suppressAutoReplanUntil: Date.now() + Math.max(0, milliseconds),
    }),
  resetPlanner: () =>
    set({
      startLocation: "",
      destination: "",
      transportationMode: "",
      budget: null,
      days: null,
      interests: [],
      trip: null,
      loading: false,
      aiSuggestions: [],
      selectedActivities: [],
      pinnedActivities: [],
      streamingStatus: null,
      streamMessages: [],
      tripMetadata: {
        lastGeneratedAt: null,
        requestCount: 0,
        error: null,
      },
      userEdits: [],
      suppressAutoReplanUntil: 0,
    }),
}))
