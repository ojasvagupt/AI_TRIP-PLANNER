import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  buildApiUrl,
  isGatewayStatus,
  normalizeGatewayStatusMessage,
  normalizeNetworkErrorMessage,
} from "../config/api"
import { useTripStore } from "../store/tripStore"
import type { TripPlan } from "../types/trip"

type TripStreamEvent =
  | { type: "status"; message: string }
  | { type: "day_plan"; data: TripPlan }
  | { type: "trip"; data: TripPlan }
  | { type: "error"; message: string }
  | { type: "complete" }

type ApiErrorDetail = {
  code?: string
  message?: string
}

class ApiRequestError extends Error {
  code: string | null
  status: number

  constructor(message: string, code: string | null = null, status = 0) {
    super(message)
    this.name = "ApiRequestError"
    this.code = code
    this.status = status
  }
}

async function buildApiRequestError(response: Response) {
  let code: string | null = null
  let message = `Request failed with status ${response.status}`

  try {
    const payload = await response.json() as { detail?: string | ApiErrorDetail }
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      message = payload.detail
    } else if (payload.detail && typeof payload.detail === "object") {
      if (typeof payload.detail.code === "string" && payload.detail.code.trim()) {
        code = payload.detail.code
      }
      if (typeof payload.detail.message === "string" && payload.detail.message.trim()) {
        message = payload.detail.message
      }
    }
  } catch {
    try {
      const fallbackText = await response.text()
      if (fallbackText.trim()) {
        message = fallbackText
      }
    } catch {
      // Keep default status-based message.
    }
  }

  message = normalizeGatewayStatusMessage(response.status, message)
  return new ApiRequestError(message, code, response.status)
}

function shouldClearTripForValidationError(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return false
  }

  if (error.status !== 400) {
    return false
  }

  return (
    error.code === "BUDGET_TOO_LOW_FOR_TRANSPORT"
    || error.code === "INVALID_BUDGET"
    || error.code === "INVALID_DAYS"
  )
}

function normalizeTripError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes("maximum output retries") || normalized.includes("invalid structured output")) {
    return "The AI model returned invalid itinerary data multiple times. Please try again."
  }

  if (normalized.includes("could not reach ollama")) {
    return "Ollama is not reachable on 127.0.0.1:11434. Start Ollama and retry."
  }

  return normalizeNetworkErrorMessage(message)
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

async function fetchWithGatewayRetry(input: RequestInfo | URL, init?: RequestInit) {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (init?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError")
    }

    try {
      lastResponse = await fetch(input, init)
    } catch (error) {
      if (attempt === 0 && error instanceof TypeError) {
        await wait(300)
        continue
      }
      throw error
    }

    if (attempt === 0 && isGatewayStatus(lastResponse.status)) {
      await wait(300)
      continue
    }

    return lastResponse
  }

  return lastResponse as Response
}

function formatInterests(interests: string[]) {
  return interests.join(", ")
}

function parseInterests(input: string) {
  return input
    .split(",")
    .map((interest) => interest.trim())
    .filter(Boolean)
}

function TripForm() {
  const [autoReplanning, setAutoReplanning] = useState(false)
  const [interestsInput, setInterestsInput] = useState(() =>
    formatInterests(useTripStore.getState().interests)
  )
  const previousPreferencesKey = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeRequestIdRef = useRef(0)

  const {
    startLocation,
    destination,
    transportationMode,
    budget,
    days,
    trip,
    userEdits,
    loading,
    tripMetadata,
    suppressAutoReplanUntil,
    updatePreferences,
    setTrip,
    setLoading,
    setAiSuggestions,
    setSelectedActivities,
    setStreamingStatus,
    appendStreamMessage,
    clearStreamMessages,
    setTripMetadata,
  } = useTripStore()

  const parsedInterests = useMemo(
    () => parseInterests(interestsInput),
    [interestsInput]
  )

  const preferencesKey = useMemo(
    () => JSON.stringify({
      startLocation,
      destination,
      transportationMode,
      budget,
      days,
      interests: parsedInterests,
    }),
    [startLocation, destination, transportationMode, budget, days, parsedInterests]
  )

  const applyTripResult = useCallback((nextTrip: TripPlan) => {
    const safeItinerary = Array.isArray(nextTrip.itinerary)
      ? nextTrip.itinerary
      : []

    setTrip(nextTrip)
    setAiSuggestions(
      safeItinerary
        .flatMap((day) => (Array.isArray(day.activities) ? day.activities : []))
        .filter((activity): activity is string => typeof activity === "string" && Boolean(activity.trim()))
        .slice(0, 5)
    )
    setSelectedActivities([])
    setTripMetadata({
      lastGeneratedAt: new Date().toISOString(),
      requestCount: useTripStore.getState().tripMetadata.requestCount + 1,
      error: null,
    })
  }, [setAiSuggestions, setSelectedActivities, setTrip, setTripMetadata])

  const handleStreamEvent = useCallback((event: TripStreamEvent) => {
    if (event.type === "status") {
      setStreamingStatus(event.message)
      appendStreamMessage(event.message)
      return
    }

    if (event.type === "day_plan") {
      setTrip(event.data)
      return
    }

    if (event.type === "trip") {
      applyTripResult(event.data)
      return
    }

    if (event.type === "error") {
      const normalizedMessage = normalizeTripError(event.message)
      setTripMetadata({ error: normalizedMessage })
      appendStreamMessage(`Error: ${normalizedMessage}`)
      return
    }

    setStreamingStatus(null)
  }, [appendStreamMessage, applyTripResult, setStreamingStatus, setTrip, setTripMetadata])

  const generateTrip = useCallback(async (
    source: "manual" | "auto" | "improve" = "manual",
    chatInstruction = ""
  ) => {
    if (
      !startLocation.trim()
      || !destination.trim()
      || budget === null
      || budget <= 0
      || days === null
      || days <= 0
    ) {
      if (source === "manual") {
        setTripMetadata({
          error: "Please fill Start Location, Destination, Budget (INR), and No. of Days.",
        })
      }
      return
    }

    previousPreferencesKey.current = preferencesKey
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    const requestId = Date.now()
    activeRequestIdRef.current = requestId

    try {
      setLoading(true)
      setTripMetadata({ error: null })
      clearStreamMessages()
      setStreamingStatus(
        source === "auto"
          ? "Replanning itinerary..."
          : source === "improve"
            ? "Improving itinerary with AI..."
            : "Starting trip generation..."
      )

      if (source === "auto") {
        setAutoReplanning(true)
      }

      const healthResponse = await fetchWithGatewayRetry(buildApiUrl("/health"), {
        signal: controller.signal,
      })
      if (!healthResponse.ok) {
        throw await buildApiRequestError(healthResponse)
      }

      const response = await fetchWithGatewayRetry(buildApiUrl("/plan-trip/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
            start_location: startLocation,
            destination,
            transport_mode: transportationMode,
            budget,
            days,
            interests: parsedInterests,
            chat_instruction: chatInstruction || undefined,
        }),
      })

      if (!response.ok) {
        throw await buildApiRequestError(response)
      }

      if (!response.body) {
        throw new Error("Streaming response was empty.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) {
            continue
          }

          const event = JSON.parse(line) as TripStreamEvent
          if (activeRequestIdRef.current !== requestId) {
            continue
          }
          handleStreamEvent(event)
        }
      }

      if (buffer.trim()) {
        const event = JSON.parse(buffer) as TripStreamEvent
        if (activeRequestIdRef.current !== requestId) {
          return
        }
        handleStreamEvent(event)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      if (activeRequestIdRef.current !== requestId) {
        return
      }

      const normalizedMessage = normalizeTripError(
        error instanceof Error ? error.message : "Failed to generate itinerary"
      )
      if (shouldClearTripForValidationError(error)) {
        setTrip(null)
      }
      setTripMetadata({ error: normalizedMessage })
      console.error(error)
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }

      if (activeRequestIdRef.current === requestId) {
        setStreamingStatus(null)

        if (source === "auto") {
          setAutoReplanning(false)
        }

        setLoading(false)
      }
    }
  }, [
    budget,
    clearStreamMessages,
    days,
    destination,
    handleStreamEvent,
    parsedInterests,
    preferencesKey,
    setLoading,
    setStreamingStatus,
    setTrip,
    setTripMetadata,
    startLocation,
    transportationMode,
  ])

  const improveWithAI = useCallback(() => {
    if (!trip) {
      setTripMetadata({ error: "Generate an initial trip plan first, then click Improve with AI." })
      return
    }

    const safeItinerary = Array.isArray(trip.itinerary) ? trip.itinerary : []
    const itinerarySummary = safeItinerary
      .map((day) => {
        const dayActivities = Array.isArray(day.activities) ? day.activities : []
        return `Day ${day.day}: ${day.title}. Activities: ${dayActivities.join(", ")}`
      })
      .join(" | ")

    const editsSummary = userEdits
      .slice(-8)
      .map((edit) => `${edit.action} on day ${edit.day}: "${edit.previousValue}" -> "${edit.nextValue}"`)
      .join(" ; ")

    const instruction = [
      "Improve the current itinerary quality and practicality.",
      `Current itinerary: ${itinerarySummary}`,
      transportationMode
        ? `Keep transport choices aligned with preferred mode: ${transportationMode}.`
        : "Recommend efficient transportation choices.",
      editsSummary ? `Respect recent user edits: ${editsSummary}.` : "",
      "Optimize day flow, reduce unnecessary backtracking, add better local experiences, and keep budget realistic.",
    ]
      .filter(Boolean)
      .join(" ")

    void generateTrip("improve", instruction)
  }, [generateTrip, setTripMetadata, transportationMode, trip, userEdits])

  useEffect(() => {
    if (!trip) {
      previousPreferencesKey.current = null
    }
  }, [trip])

  useEffect(() => {
    if (!trip || !startLocation.trim() || !destination.trim()) {
      return
    }

    if (Date.now() < suppressAutoReplanUntil) {
      previousPreferencesKey.current = preferencesKey
      return
    }

    if (previousPreferencesKey.current === null) {
      previousPreferencesKey.current = preferencesKey
      return
    }

    if (previousPreferencesKey.current === preferencesKey) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      if (loading) {
        return
      }

      previousPreferencesKey.current = preferencesKey
      void generateTrip("auto")
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [destination, generateTrip, loading, preferencesKey, startLocation, suppressAutoReplanUntil, trip])

  useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    []
  )

  return (
    <div className={`micro-fade-up micro-replan-transition micro-hover-lift rounded-3xl border border-teal-100 bg-white p-6 shadow-[0_18px_46px_rgba(15,23,42,0.08)] transition duration-300 hover:shadow-[0_24px_56px_rgba(15,23,42,0.12)] md:p-8 ${loading ? "micro-replanning-soften" : ""}`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">
            Create Your Trip
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Fill the essentials, then use chat to refine like a copilot.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-medium text-teal-700 transition hover:-translate-y-0.5 hover:bg-teal-100">
            INR Budget
          </span>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 font-medium text-orange-700 transition hover:-translate-y-0.5 hover:bg-orange-100">
            Live Replanning
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">
          Route
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none transition hover:border-teal-200 hover:bg-white focus:border-teal-300 focus:bg-white"
            placeholder="Start Location (e.g., Delhi)"
            value={startLocation}
            onChange={(e) => updatePreferences({ startLocation: e.target.value })}
          />

          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none transition hover:border-teal-200 hover:bg-white focus:border-teal-300 focus:bg-white"
            placeholder="Destination (e.g., Goa)"
            value={destination}
            onChange={(e) => updatePreferences({ destination: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-semibold text-slate-800">
          Trip Constraints
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="number"
            min={1}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none transition hover:border-teal-200 hover:bg-white focus:border-teal-300 focus:bg-white"
            placeholder="Budget (INR)"
            value={budget ?? ""}
            onChange={(e) => {
              const nextValue = e.target.value
              updatePreferences({
                budget: nextValue === "" ? null : Number(nextValue),
              })
            }}
          />

          <input
            type="number"
            min={1}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none transition hover:border-teal-200 hover:bg-white focus:border-teal-300 focus:bg-white"
            placeholder="No. of Days"
            value={days ?? ""}
            onChange={(e) => {
              const nextValue = e.target.value
              updatePreferences({
                days: nextValue === "" ? null : Number(nextValue),
              })
            }}
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-semibold text-slate-800">
          Travel Preference
        </p>
        <input
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none transition hover:border-teal-200 hover:bg-white focus:border-teal-300 focus:bg-white"
          placeholder="Preferred mode (e.g., Flight, Train, Bus, Car)"
          value={transportationMode}
          onChange={(e) => updatePreferences({ transportationMode: e.target.value })}
        />
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-semibold text-slate-800">
          Interests
        </p>
        <input
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none transition hover:border-teal-200 hover:bg-white focus:border-teal-300 focus:bg-white"
          placeholder="food, beaches, nightlife, culture..."
          value={interestsInput}
          onChange={(e) => {
            setInterestsInput(e.target.value)
          }}
          onBlur={() => {
            updatePreferences({
              interests: parsedInterests,
            })
          }}
        />
      </div>

      <button
        onClick={() => void generateTrip("manual")}
        disabled={loading}
        className="mt-6 w-full rounded-2xl bg-teal-600 p-3.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_10px_22px_rgba(13,148,136,0.35)] disabled:opacity-70"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="micro-pulse inline-block h-2 w-2 rounded-full bg-white/90" aria-hidden />
            {autoReplanning ? "Replanning..." : "Generating..."}
          </span>
        ) : "Generate Trip Plan"}
      </button>

      <button
        onClick={improveWithAI}
        disabled={loading || !trip}
        className="mx-auto mt-4 block rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:from-orange-600 hover:to-amber-600 hover:shadow-[0_12px_24px_rgba(249,115,22,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Improve with AI
      </button>

      {!trip && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Generate a plan first, then use Improve with AI for refinements.
        </p>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Realtime updates are enabled for budget, days, and interests.
      </p>

      {tripMetadata.error && (
        <p className="micro-fade-up mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {tripMetadata.error}
        </p>
      )}
    </div>
  )
}

export default TripForm
