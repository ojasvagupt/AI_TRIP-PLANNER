export interface TripPlanResponse {
  response: string;
  status: 'success' | 'error';
  error?: string;
}

export interface TripPlan {
  destination: string;
  duration: number;
  interests: string[];
  plan: string;
  loading: boolean;
  error: string | null;
}
