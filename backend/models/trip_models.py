from pydantic import BaseModel

class TripRequest(BaseModel):
    start_location: str = ""
    destination: str
    budget: int
    days: int
    interests: list[str]
    transport_mode: str = ""
    chat_instruction: str = ""


class DayPlan(BaseModel):
    day: int
    title: str
    activities: list[str]


class TripPlan(BaseModel):
    destination: str
    total_budget: int
    itinerary: list[DayPlan]
