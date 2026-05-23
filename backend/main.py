import asyncio
import json
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from agents import travel_agent
from models.trip_models import TripRequest

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

def _normalize_transport_mode(mode: str) -> str:
    normalized_mode = mode.strip().lower()
    if "flight" in normalized_mode or "plane" in normalized_mode:
        return "flight"
    if "train" in normalized_mode:
        return "train"
    if "bus" in normalized_mode:
        return "bus"
    if "bike" in normalized_mode or "scooter" in normalized_mode:
        return "bike"
    if "car" in normalized_mode or "cab" in normalized_mode:
        return "car"
    return "flexible"

def _transport_mode_label(mode_key: str) -> str:
    labels = {
        "flight": "Flight",
        "train": "Train",
        "bus": "Bus",
        "bike": "Bike/Scooter",
        "car": "Car/Cab",
        "flexible": "Flexible mode",
    }
    return labels.get(mode_key, "Selected mode")

def _minimum_budget_for_request(days: int, mode_key: str) -> int:
    # Practical baseline for food + local movement + stay in INR.
    base_daily_cost = 1600
    # Approximate floor for primary intercity movement in INR.
    mode_cost_floor = {
        "flight": 6500,
        "train": 1800,
        "bus": 1200,
        "bike": 1000,
        "car": 2800,
        "flexible": 1500,
    }

    safe_days = max(days, 1)
    return safe_days * base_daily_cost + mode_cost_floor.get(mode_key, 1500)

def _affordable_alternative_modes(days: int, budget: int, current_mode_key: str) -> list[str]:
    candidate_modes = ["bus", "train", "bike", "car", "flight"]
    alternatives: list[str] = []

    for mode_key in candidate_modes:
        if mode_key == current_mode_key:
            continue
        if budget >= _minimum_budget_for_request(days, mode_key):
            alternatives.append(_transport_mode_label(mode_key))
        if len(alternatives) >= 3:
            break

    return alternatives

def validate_trip_feasibility(data: TripRequest) -> None:
    if data.budget <= 0:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_BUDGET",
                "message": "Budget must be greater than ₹0.",
            },
        )

    if data.days <= 0:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_DAYS",
                "message": "Number of days must be at least 1.",
            },
        )

    mode_key = _normalize_transport_mode(data.transport_mode)
    minimum_budget = _minimum_budget_for_request(data.days, mode_key)
    if data.budget >= minimum_budget:
        return

    mode_label = _transport_mode_label(mode_key)
    alternative_modes = _affordable_alternative_modes(data.days, data.budget, mode_key)
    alternatives_text = (
        f" Try {', '.join(alternative_modes)} instead."
        if alternative_modes
        else " Consider lowering trip days or choosing a cheaper travel mode."
    )
    message = (
        f"{mode_label} is likely not feasible for a {data.days}-day trip with ₹{data.budget:,}. "
        f"Suggested minimum budget is around ₹{minimum_budget:,}. "
        f"Please increase your budget or change transportation mode.{alternatives_text}"
    )

    raise HTTPException(
        status_code=400,
        detail={
            "code": "BUDGET_TOO_LOW_FOR_TRANSPORT",
            "message": message,
            "minimum_budget_inr": minimum_budget,
            "provided_budget_inr": data.budget,
            "days": data.days,
            "transport_mode": mode_label,
            "alternative_modes": alternative_modes,
        },
    )

def _split_total_by_weights(total_budget: int, weights: list[float]) -> list[int]:
    if not weights:
        return []

    if total_budget <= 0:
        return [0 for _ in weights]

    safe_weights = [max(weight, 0.0) for weight in weights]
    total_weight = sum(safe_weights)
    if total_weight <= 0:
        safe_weights = [1.0 for _ in weights]
        total_weight = float(len(weights))

    raw_amounts = [total_budget * (weight / total_weight) for weight in safe_weights]
    split_amounts = [int(amount) for amount in raw_amounts]
    remainder = total_budget - sum(split_amounts)

    ranked_indices = sorted(
        range(len(raw_amounts)),
        key=lambda index: raw_amounts[index] - split_amounts[index],
        reverse=True,
    )
    for index in ranked_indices[:remainder]:
        split_amounts[index] += 1

    return split_amounts

def _round_down_to_nearest(value: int, unit: int) -> int:
    if unit <= 0:
        return value
    return (value // unit) * unit

def _round_up_to_nearest(value: int, unit: int) -> int:
    if unit <= 0:
        return value
    return ((value + unit - 1) // unit) * unit

def _build_amount_range(amount: int, spread: float, rounding_unit: int = 100) -> dict[str, int]:
    if amount <= 0:
        return {"min_amount": 0, "max_amount": 0}

    delta = max(int(round(amount * spread)), rounding_unit)
    min_amount = max(0, amount - delta)
    max_amount = amount + delta

    return {
        "min_amount": _round_down_to_nearest(min_amount, rounding_unit),
        "max_amount": _round_up_to_nearest(max_amount, rounding_unit),
    }

def _category_weights_for_transport(mode: str) -> list[tuple[str, float]]:
    normalized_mode = mode.strip().lower()
    if "flight" in normalized_mode or "plane" in normalized_mode:
        return [
            ("Transport", 0.32),
            ("Stay", 0.31),
            ("Food", 0.18),
            ("Experiences", 0.14),
            ("Local Misc", 0.05),
        ]
    if "train" in normalized_mode:
        return [
            ("Transport", 0.22),
            ("Stay", 0.35),
            ("Food", 0.20),
            ("Experiences", 0.18),
            ("Local Misc", 0.05),
        ]
    if "bus" in normalized_mode or "bike" in normalized_mode or "scooter" in normalized_mode:
        return [
            ("Transport", 0.19),
            ("Stay", 0.36),
            ("Food", 0.21),
            ("Experiences", 0.19),
            ("Local Misc", 0.05),
        ]
    if "car" in normalized_mode or "cab" in normalized_mode:
        return [
            ("Transport", 0.24),
            ("Stay", 0.34),
            ("Food", 0.20),
            ("Experiences", 0.17),
            ("Local Misc", 0.05),
        ]
    return [
        ("Transport", 0.25),
        ("Stay", 0.35),
        ("Food", 0.20),
        ("Experiences", 0.15),
        ("Local Misc", 0.05),
    ]

def _classify_activity(activity: str) -> str:
    normalized_activity = activity.lower()

    if any(keyword in normalized_activity for keyword in ["hotel", "check in", "check-in", "resort", "stay"]):
        return "Stay"
    if any(keyword in normalized_activity for keyword in ["taxi", "bus", "train", "flight", "drive", "transfer", "ride"]):
        return "Transport"
    if any(keyword in normalized_activity for keyword in ["meal", "lunch", "dinner", "breakfast", "cafe", "food", "restaurant"]):
        return "Food"
    if any(keyword in normalized_activity for keyword in ["ticket", "entry", "shopping", "souvenir"]):
        return "Local Misc"
    return "Experiences"

def enrich_trip_with_budget_breakdown(trip_payload: dict[str, Any], transport_mode: str) -> dict[str, Any]:
    total_budget = int(trip_payload.get("total_budget") or 0)
    itinerary = trip_payload.get("itinerary") or []

    category_weights = _category_weights_for_transport(transport_mode)
    category_labels = [item[0] for item in category_weights]
    category_values = [item[1] for item in category_weights]
    category_amounts = _split_total_by_weights(total_budget, category_values)

    category_totals = [
        {
            "category": category,
            **_build_amount_range(amount, spread=0.12),
        }
        for category, amount in zip(category_labels, category_amounts)
    ]

    day_weights = [float(max(len(day.get("activities", [])), 1)) for day in itinerary]
    day_amounts = _split_total_by_weights(total_budget, day_weights)

    category_multipliers = {
        "Transport": 1.2,
        "Stay": 1.35,
        "Food": 0.9,
        "Experiences": 1.0,
        "Local Misc": 0.75,
    }

    day_breakdown = []
    for day, day_total in zip(itinerary, day_amounts):
        activities = day.get("activities", []) or []
        if not activities:
            day_breakdown.append(
                {
                    "day": day.get("day"),
                    "title": day.get("title"),
                    **_build_amount_range(day_total, spread=0.14),
                    "items": [
                        {
                            "activity": "General day expenses",
                            "category": "Experiences",
                            **_build_amount_range(day_total, spread=0.20),
                        }
                    ],
                }
            )
            continue

        activity_categories = [_classify_activity(activity) for activity in activities]
        activity_weights = [category_multipliers.get(category, 1.0) for category in activity_categories]
        activity_amounts = _split_total_by_weights(day_total, activity_weights)

        items = []
        for activity, category, amount in zip(activities, activity_categories, activity_amounts):
            items.append(
                {
                    "activity": activity,
                    "category": category,
                    **_build_amount_range(amount, spread=0.22),
                }
            )

        day_breakdown.append(
            {
                "day": day.get("day"),
                "title": day.get("title"),
                **_build_amount_range(sum(activity_amounts), spread=0.14),
                "items": items,
            }
        )

    enriched_payload = dict(trip_payload)
    enriched_payload["budget_breakdown"] = {
        "currency": "INR",
        "category_totals": category_totals,
        "day_breakdown": day_breakdown,
        "notes": "Estimated budget breakup for planning guidance. Actual prices can vary.",
    }
    return enriched_payload

def build_trip_prompt(data: TripRequest) -> str:
    start_location = data.start_location.strip() or "Not provided"
    transport_mode = data.transport_mode.strip() or "No strict preference"
    chat_instruction = data.chat_instruction.strip()
    instruction_block = (
        f"\n    Additional User Request:\n    {chat_instruction}\n"
        if chat_instruction
        else ""
    )

    return f"""
    Start Location: {start_location}
    Destination: {data.destination}
    Preferred Transportation Mode: {transport_mode}
    Budget (INR): {data.budget}
    Days: {data.days}

    Interests:
    {", ".join(data.interests)}
    {instruction_block}

    Generate a detailed itinerary.
    Plan travel from start location to destination.
    Prioritize the preferred transportation mode when planning movement.
    Use INR for all budget considerations.
    Adapt the itinerary to match the additional user request when present.
    Return exactly {data.days} day entries.
    """

@app.post("/plan-trip")
async def plan_trip(data: TripRequest):
    validate_trip_feasibility(data)
    prompt = build_trip_prompt(data)

    try:
        result = await travel_agent.run(prompt)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Trip planning failed: {exc}",
        ) from exc

    trip_output = result.output
    trip_payload = trip_output.model_dump() if hasattr(trip_output, "model_dump") else trip_output
    return enrich_trip_with_budget_breakdown(trip_payload, data.transport_mode)

@app.post("/plan-trip/stream")
async def plan_trip_stream(data: TripRequest):
    validate_trip_feasibility(data)
    prompt = build_trip_prompt(data)

    async def event_stream():
        def emit(payload: dict) -> str:
            return json.dumps(payload) + "\n"

        yield emit({"type": "status", "message": "Starting trip generation..."})
        await asyncio.sleep(0.05)
        yield emit({"type": "status", "message": "Analyzing destination and preferences..."})
        await asyncio.sleep(0.05)
        yield emit({"type": "status", "message": "Building day-by-day itinerary..."})

        try:
            result = await travel_agent.run(prompt)
        except Exception as exc:
            yield emit({"type": "error", "message": f"Trip planning failed: {exc}"})
            yield emit({"type": "complete"})
            return

        trip_output = result.output
        trip_payload = trip_output.model_dump() if hasattr(trip_output, "model_dump") else trip_output
        enriched_trip_payload = enrich_trip_with_budget_breakdown(trip_payload, data.transport_mode)

        itinerary = enriched_trip_payload.get("itinerary", [])
        partial_itinerary = []
        for day in itinerary:
            partial_itinerary.append(day)
            budget_breakdown = enriched_trip_payload.get("budget_breakdown") or {}
            partial_budget_breakdown = dict(budget_breakdown)
            partial_budget_breakdown["day_breakdown"] = (
                budget_breakdown.get("day_breakdown", [])[: len(partial_itinerary)]
            )

            yield emit({
                "type": "status",
                "message": f"Generated day {day.get('day')}: {day.get('title')}",
            })
            yield emit({
                "type": "day_plan",
                "data": {
                    "destination": enriched_trip_payload.get("destination"),
                    "total_budget": enriched_trip_payload.get("total_budget"),
                    "itinerary": list(partial_itinerary),
                    "budget_breakdown": partial_budget_breakdown,
                },
            })
            await asyncio.sleep(0.03)

        yield emit({"type": "trip", "data": enriched_trip_payload})
        yield emit({"type": "complete"})

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
