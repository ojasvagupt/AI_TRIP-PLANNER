# AI Trip Planner

Beginner-friendly setup guide to run this project locally from scratch.

This project has 3 parts:
1. Ollama (local AI model server)
2. FastAPI backend (`backend/`)
3. React frontend (`frontend/`)

You must run all 3 for the app to work.

## 1) Prerequisites

Install these first:

1. `Git`
2. `Python 3.10+` (recommended `3.11`)
3. `Node.js 18+` (recommended `20+`)
4. `npm` (comes with Node)
5. `Ollama` from `https://ollama.com/download`

Check versions:

```bash
git --version
python3 --version
node --version
npm --version
ollama --version
```

## 2) Clone The Repository

```bash
git clone https://github.com/gauriwanare/AI-Trip-Planner.git
cd AI-Trip-Planner
```

## 3) Backend Setup (FastAPI)

Run this from project root:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Windows PowerShell:

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4) Start Ollama And Download Model

Open a new terminal window and run:

```bash
ollama serve
```

Open one more terminal window and run:

```bash
ollama pull qwen2.5:7b
```

Keep Ollama running.

## 5) Run Backend API

In backend terminal (with virtualenv active):

```bash
cd AI-Trip-Planner/backend
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend should start on:

`http://127.0.0.1:8000`

Quick API check:

```bash
curl http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok"}
```

## 6) Run Frontend

Open another terminal:

```bash
cd AI-Trip-Planner/frontend
npm install
npm run dev
```

Frontend should start on:

`http://127.0.0.1:5173`

Open that URL in your browser.

## 7) First Successful Run Checklist

Before generating a trip, confirm all are running:

1. Ollama terminal is running `ollama serve`
2. Backend terminal shows `Uvicorn running on http://127.0.0.1:8000`
3. Frontend terminal shows `Local: http://127.0.0.1:5173/`

Then in UI:

1. Fill Start Location
2. Fill Destination
3. Fill Budget
4. Fill Days
5. Fill Interests
6. Click `Generate Trip Plan`

## 8) Common Errors And Fixes

### Error: `Request failed with status 502`

Cause:
- frontend is running, but backend was not reachable for a moment.

Fix:
1. Check backend terminal is still running on port `8000`
2. If backend stopped, restart:

```bash
cd AI-Trip-Planner/backend
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

3. Refresh browser and retry.

### Error: `Failed to fetch`

Cause:
- browser could not connect to backend.

Fix:
1. Start backend.
2. Confirm `curl http://127.0.0.1:8000/health` returns `{"status":"ok"}`.
3. Retry from UI.

### Error: `Could not reach Ollama`

Cause:
- backend cannot connect to Ollama.

Fix:
1. Start Ollama:

```bash
ollama serve
```

2. Ensure model exists:

```bash
ollama list
```

3. If missing, pull it:

```bash
ollama pull qwen2.5:7b
```

### Error: `Error loading ASGI app` or import issues

Cause:
- running `uvicorn` from wrong folder.

Fix:
- run backend commands from `AI-Trip-Planner/backend`, not from root.

## 9) API Endpoints

Backend endpoints:

1. `GET /health`
2. `POST /plan-trip`
3. `POST /plan-trip/stream` (NDJSON streaming)

## 10) Environment Variables

Backend reads `backend/.env`.

Important variable:

`OLLAMA_BASE_URL=http://localhost:11434/v1`

The backend also supports default fallback to `http://127.0.0.1:11434`.

## 11) Frontend API Configuration

Local dev uses Vite proxy:

- frontend calls `/api/...`
- Vite forwards it to `http://127.0.0.1:8000`

If you want to bypass proxy (for deployed backend), create `frontend/.env`:

```bash
VITE_API_BASE_URL=https://your-backend-domain.com
```

Then restart frontend.

## 12) Helpful Commands

From `frontend/`:

```bash
npm run dev
npm run build
npm run lint
```

From `backend/`:

```bash
source venv/bin/activate
uvicorn main:app --reload
```
