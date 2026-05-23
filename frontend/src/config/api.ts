const configuredApiBaseUrl = typeof import.meta.env.VITE_API_BASE_URL === "string"
  ? import.meta.env.VITE_API_BASE_URL.trim()
  : ""

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "")

export const API_BASE_URL = configuredApiBaseUrl
  ? trimTrailingSlashes(configuredApiBaseUrl)
  : "/api"

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export function normalizeNetworkErrorMessage(message: string) {
  const normalized = message.toLowerCase()

  if (
    normalized.includes("failed to fetch")
    || normalized.includes("networkerror")
    || normalized.includes("load failed")
  ) {
    return "Cannot connect to the trip backend. Start backend with: cd backend && source venv/bin/activate && uvicorn main:app --reload"
  }

  return message
}

export function normalizeGatewayStatusMessage(status: number, currentMessage: string) {
  if (status === 502 || status === 503 || status === 504) {
    return "Backend is unavailable right now. Start backend with: cd backend && source venv/bin/activate && uvicorn main:app --reload"
  }

  return currentMessage
}

export function isGatewayStatus(status: number) {
  return status === 502 || status === 503 || status === 504
}
