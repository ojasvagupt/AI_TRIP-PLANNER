import { useEffect, useMemo, useRef, useState } from "react"
import { useTripStore } from "../store/tripStore"
import type { AgentChatMessage, TripPlan } from "../types/trip"

const API_BASE_URL = "http://127.0.0.1:8000"

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

const BASE_SUGGESTIONS = [
  "Make a plan for just today evening with food and live music.",
  "Keep this itinerary relaxed with less travel time.",
  "Add more local culture and hidden gems.",
  "Make it couple-friendly with sunset spots.",
]

function normalizeTripError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes("maximum output retries") || normalized.includes("invalid structured output")) {
    return "The AI had trouble formatting the itinerary. Please try again."
  }

  if (normalized.includes("could not reach ollama")) {
    return "Ollama is not reachable on 127.0.0.1:11434. Start Ollama and retry."
  }

  return message
}

function buildAssistantSummary(trip: TripPlan, instruction: string) {
  const safeItinerary = Array.isArray(trip.itinerary) ? trip.itinerary : []
  const firstDay = safeItinerary[0]
  if (!firstDay) {
    return `Updated your plan for: "${instruction}"`
  }

  const safeActivities = Array.isArray(firstDay.activities)
    ? firstDay.activities
    : []
  const highlights = safeActivities.slice(0, 2).join(" • ")
  return `Done. I updated your itinerary for: "${instruction}". Day ${firstDay.day} now focuses on ${highlights}.`
}

function extractDaysFromPrompt(prompt: string) {
  const match = prompt.match(/(\d+)\s*day/i)
  if (!match) {
    return null
  }
  const days = Number(match[1])
  return Number.isFinite(days) && days > 0 ? days : null
}

function extractDestinationFromPrompt(prompt: string) {
  const match = prompt.match(/\bto\s+([a-zA-Z][a-zA-Z\s-]{1,40})/i)
  if (!match) {
    return null
  }

  return match[1]
    .replace(/\b(for|with|on|in|from)\b.*$/i, "")
    .trim()
}

function extractTransportModeFromPrompt(prompt: string) {
  const match = prompt.match(/\b(flight|plane|train|bus|car|cab|bike|scooter)\b/i)
  if (!match) {
    return null
  }

  const mode = match[1].toLowerCase()
  if (mode === "plane") {
    return "Flight"
  }
  if (mode === "cab") {
    return "Car"
  }
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

function AgentChat() {
  const [input, setInput] = useState("")
  const [agentStatus, setAgentStatus] = useState<string | null>(null)
  const activeRequestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const messageSequenceRef = useRef(0)
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "Hi, I’m your trip copilot. Ask me to refine your plan in plain English.",
    },
  ])

  const {
    startLocation,
    destination,
    transportationMode,
    budget,
    days,
    interests,
    aiSuggestions,
    loading,
    updatePreferences,
    suppressAutoReplanFor,
    setTrip,
    setLoading,
    setAiSuggestions,
    setSelectedActivities,
    setStreamingStatus,
    appendStreamMessage,
    clearStreamMessages,
    setTripMetadata,
  } = useTripStore()

  const quickSuggestions = useMemo(() => {
    const dynamic = aiSuggestions.slice(0, 3).map((activity) => `Include "${activity}" in the plan.`)
    const merged = [...BASE_SUGGESTIONS, ...dynamic]
    return [...new Set(merged)].slice(0, 6)
  }, [aiSuggestions])

  const nextMessageId = () => {
    messageSequenceRef.current += 1
    return `message-${messageSequenceRef.current}`
  }

  const nextRequestId = () => {
    requestSequenceRef.current += 1
    return requestSequenceRef.current
  }

  const appendChatMessage = (role: AgentChatMessage["role"], text: string) => {
    setMessages((previous) => [
      ...previous,
      {
        id: nextMessageId(),
        role,
        text,
      },
    ])
  }

  const applyTripResult = (nextTrip: TripPlan) => {
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
  }

  const runAgentPrompt = async (prompt: string) => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      return
    }

    appendChatMessage("user", trimmedPrompt)
    setInput("")

    const promptDays = extractDaysFromPrompt(trimmedPrompt)
    const promptDestination = extractDestinationFromPrompt(trimmedPrompt)
    const promptTransportMode = extractTransportModeFromPrompt(trimmedPrompt)

    suppressAutoReplanFor(4500)

    if (promptDestination) {
      updatePreferences({ destination: promptDestination })
    }
    if (promptDays) {
      updatePreferences({ days: promptDays })
    }
    if (promptTransportMode) {
      updatePreferences({ transportationMode: promptTransportMode })
    }

    const resolvedDestination = (promptDestination ?? destination).trim()
    const resolvedDays = promptDays ?? days ?? (/(today|tonight|evening)/i.test(trimmedPrompt) ? 1 : null)
    const resolvedTransportationMode = promptTransportMode ?? transportationMode
    const resolvedBudget = budget ?? (resolvedDays ? resolvedDays * 3500 : null)
    const resolvedStartLocation = startLocation.trim() || "Not provided"

    if (budget === null && resolvedBudget) {
      updatePreferences({ budget: resolvedBudget })
      appendChatMessage("assistant", `Using an estimated budget of ₹${resolvedBudget.toLocaleString("en-IN")} for this request.`)
    }

    if (
      !resolvedDestination
      || resolvedBudget === null
      || resolvedBudget <= 0
      || resolvedDays === null
      || resolvedDays <= 0
    ) {
      const missingDataMessage = "Please include destination and trip duration in the chat prompt, or fill them in the form."
      appendChatMessage("assistant", missingDataMessage)
      setTripMetadata({ error: missingDataMessage })
      return
    }

    let plannedTrip: TripPlan | null = null
    const requestId = nextRequestId()
    activeRequestIdRef.current = requestId
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setLoading(true)
      setTripMetadata({ error: null })
      clearStreamMessages()
      setStreamingStatus("Agent is updating your itinerary...")
      setAgentStatus("Thinking through your request...")

      const response = await fetch(`${API_BASE_URL}/plan-trip/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          start_location: resolvedStartLocation,
          destination: resolvedDestination,
          transport_mode: resolvedTransportationMode,
          budget: resolvedBudget,
          days: resolvedDays,
          interests,
          chat_instruction: trimmedPrompt,
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

          if (event.type === "status") {
            setAgentStatus(event.message)
            appendStreamMessage(event.message)
            continue
          }

          if (event.type === "error") {
            throw new Error(normalizeTripError(event.message))
          }

          if (event.type === "day_plan") {
            plannedTrip = event.data
            setTrip(event.data)
            continue
          }

          if (event.type === "trip") {
            plannedTrip = event.data
            applyTripResult(event.data)
          }
        }
      }

      if (plannedTrip) {
        appendChatMessage("assistant", buildAssistantSummary(plannedTrip, trimmedPrompt))
      } else {
        appendChatMessage("assistant", "I could not update the plan this time. Please try again.")
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      if (activeRequestIdRef.current !== requestId) {
        return
      }

      const errorMessage = normalizeTripError(
        error instanceof Error ? error.message : "Failed to process agent request"
      )
      if (shouldClearTripForValidationError(error)) {
        setTrip(null)
      }
      setTripMetadata({ error: errorMessage })
      appendChatMessage("assistant", errorMessage)
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }

      if (activeRequestIdRef.current === requestId) {
        setLoading(false)
        setStreamingStatus(null)
        setAgentStatus(null)
      }
    }
  }

  useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    []
  )

  return (
    <aside className="xl:sticky xl:top-6">
      <div className={`micro-fade-up micro-replan-transition micro-hover-lift flex h-[62vh] min-h-[460px] flex-col overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)] transition duration-300 hover:shadow-[0_22px_56px_rgba(15,23,42,0.12)] md:min-h-[620px] xl:h-[74vh] ${loading ? "micro-replanning-soften" : ""}`}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Agentic Trip Chat
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Refine your itinerary with natural language.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`micro-fade-up micro-replan-transition max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "ml-auto bg-teal-600 text-white shadow-[0_8px_18px_rgba(13,148,136,0.22)]"
                  : "bg-amber-50 text-slate-700 shadow-[0_8px_16px_rgba(15,23,42,0.05)]"
              }`}
              style={{ animationDelay: `${80 + index * 45}ms` }}
            >
              {message.text}
            </div>
          ))}

          {agentStatus && (
            <div className="micro-fade-up micro-pulse max-w-[90%] rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 shadow-[0_8px_16px_rgba(15,23,42,0.05)]">
              {agentStatus}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
            Quick Suggestions
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {quickSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => void runAgentPrompt(suggestion)}
                className="micro-hover-lift rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition duration-200 hover:bg-teal-100 hover:shadow-[0_8px_16px_rgba(13,148,136,0.18)]"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form
            className="micro-replan-transition flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition hover:border-teal-200 hover:bg-white"
            onSubmit={(event) => {
              event.preventDefault()
              void runAgentPrompt(input)
            }}
          >
            <input
              className="w-full bg-transparent px-2 text-sm text-slate-700 outline-none"
              placeholder="Type a request, e.g. plan just for this evening..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_8px_16px_rgba(13,148,136,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <span className="micro-pulse">Sending...</span> : "Send"}
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}

export default AgentChat
