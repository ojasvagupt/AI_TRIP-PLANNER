# AI-Trip-Planner

## Local run

### 1) Start Ollama

Make sure Ollama is running on:

`http://127.0.0.1:11434`

### 2) Start backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

Backend URL:

`http://127.0.0.1:8000`

### 3) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL (usually):

`http://127.0.0.1:5173`

### 4) Quick health check

```bash
curl http://127.0.0.1:8000/health
```

Expected:

`{"status":"ok"}`
