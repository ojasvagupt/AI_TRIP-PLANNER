import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
import time
from urllib import error, request

from dotenv import load_dotenv
from pydantic import ValidationError

from models.trip_models import TripPlan

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
if ollama_base_url.endswith("/v1"):
    ollama_base_url = ollama_base_url[:-3]
ollama_chat_url = f"{ollama_base_url}/api/chat"

MODEL_NAME = "qwen2.5:7b"
REQUEST_TIMEOUT_SECONDS = 180
MAX_OUTPUT_RETRIES = 4


class OutputFormatError(RuntimeError):
    """Raised when the model returns content that does not match TripPlan."""


@dataclass
class TravelAgentResult:
    output: TripPlan


class TravelAgent:
    def __init__(self) -> None:
        self._schema = TripPlan.model_json_schema()

    def _build_messages(self, prompt: str, retry_note: str | None = None) -> list[dict[str, str]]:
        user_content = prompt
        if retry_note:
            user_content = (
                f"{prompt}\n\n"
                "The previous output was invalid for the required JSON schema. "
                f"Reason: {retry_note}\n"
                "Return only valid JSON matching the schema exactly."
            )

        return [
            {
                "role": "system",
                "content": (
                    "You are an expert AI travel planner. "
                    "Return only valid JSON that matches the provided schema exactly. "
                    "Do not wrap the response in markdown or extra text."
                ),
            },
            {"role": "user", "content": user_content},
        ]

    def _request_ollama(self, prompt: str, retry_note: str | None = None) -> str:
        payload = {
            "model": MODEL_NAME,
            "messages": self._build_messages(prompt, retry_note),
            "format": self._schema,
            "stream": False,
            "options": {
                "temperature": 0.2,
            },
        }

        http_request = request.Request(
            ollama_chat_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(http_request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return response.read().decode("utf-8")
        except error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Ollama request failed with status {exc.code}: {error_body}"
            ) from exc
        except error.URLError as exc:
            raise RuntimeError(f"Could not reach Ollama at {ollama_chat_url}: {exc.reason}") from exc

    def _parse_trip(self, raw_body: str) -> TripPlan:
        try:
            response_payload = json.loads(raw_body)
            content = response_payload["message"]["content"]
            if isinstance(content, str):
                parsed_content = json.loads(content)
            else:
                parsed_content = content
        except (KeyError, TypeError, json.JSONDecodeError) as exc:
            raise OutputFormatError("Model did not return valid JSON content.") from exc

        try:
            return TripPlan.model_validate(parsed_content)
        except ValidationError as exc:
            raise OutputFormatError(f"Schema validation failed: {exc.errors()[0]['msg']}") from exc

    def _run_sync(self, prompt: str) -> TravelAgentResult:
        retry_note: str | None = None
        last_error: OutputFormatError | None = None

        for attempt in range(1, MAX_OUTPUT_RETRIES + 1):
            raw_body = self._request_ollama(prompt, retry_note)
            try:
                parsed_trip = self._parse_trip(raw_body)
                return TravelAgentResult(output=parsed_trip)
            except OutputFormatError as exc:
                last_error = exc
                retry_note = str(exc)
                if attempt < MAX_OUTPUT_RETRIES:
                    time.sleep(0.2)

        raise RuntimeError(
            "Model returned invalid structured output after "
            f"{MAX_OUTPUT_RETRIES} attempts: {last_error}"
        )

    async def run(self, prompt: str) -> TravelAgentResult:
        return await asyncio.to_thread(self._run_sync, prompt)


travel_agent = TravelAgent()
