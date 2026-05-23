export interface DayPlan {
  day: number
  title: string
  activities: string[]
}

export interface AmountRange {
  min_amount: number
  max_amount: number
}

export interface BudgetBreakdownItem extends AmountRange {
  activity: string
  category: string
  estimated_cost?: number
}

export interface DayBudgetBreakdown extends AmountRange {
  day: number
  title: string
  estimated_total?: number
  items: BudgetBreakdownItem[]
}

export interface BudgetCategoryTotal extends AmountRange {
  category: string
  amount?: number
}

export interface BudgetBreakdown {
  currency: string
  category_totals: BudgetCategoryTotal[]
  day_breakdown: DayBudgetBreakdown[]
  notes: string
}

export interface TripPlan {
  destination: string
  total_budget: number
  itinerary: DayPlan[]
  budget_breakdown?: BudgetBreakdown
}

export interface TripRequest {
  start_location: string
  destination: string
  budget: number
  days: number
  interests: string[]
  transport_mode?: string
  chat_instruction?: string
}

export interface TripPreferences {
  startLocation: string
  destination: string
  transportationMode: string
  budget: number | null
  days: number | null
  interests: string[]
}

export interface TripMetadata {
  lastGeneratedAt: string | null
  requestCount: number
  error: string | null
}

export interface UserEdit {
  id: string
  action: "edit" | "delete" | "pin" | "unpin"
  day: number
  previousValue: string
  nextValue: string
  updatedAt: string
}

export interface AgentChatMessage {
  id: string
  role: "assistant" | "user"
  text: string
}
