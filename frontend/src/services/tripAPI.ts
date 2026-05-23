import { buildApiUrl } from "../config/api"

export interface TripPlanResponse {
  response: string;
  status: 'success' | 'error';
  error?: string;
}

interface DayPlan {
  day: number;
  title: string;
  activities: string[];
}

interface StructuredTripPlan {
  destination: string;
  total_budget: number;
  itinerary: DayPlan[];
}

function formatPlan(plan: StructuredTripPlan): string {
  const header = [
    `Destination: ${plan.destination}`,
    `Budget: ${plan.total_budget}`,
    '',
  ].join('\n');

  const days = plan.itinerary
    .map((day) => {
      const activities = day.activities.map((activity) => `- ${activity}`).join('\n');
      return `Day ${day.day}: ${day.title}\n${activities}`;
    })
    .join('\n\n');

  return `${header}${days}`;
}

export const tripAPI = {
  async planTrip(destination: string, duration: number, interests: string[]): Promise<TripPlanResponse> {
    try {
      const response = await fetch(buildApiUrl("/plan-trip"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destination,
          budget: 20000,
          days: duration,
          interests,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data: StructuredTripPlan = await response.json();
      return {
        response: formatPlan(data),
        status: 'success',
      };
    } catch (error) {
      return {
        response: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },

  async getHealth(): Promise<boolean> {
    try {
      const response = await fetch(buildApiUrl("/health"));
      return response.ok;
    } catch {
      return false;
    }
  },
};
