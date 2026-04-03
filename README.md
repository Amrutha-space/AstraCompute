# AstraCompute

Intelligent CPU-GPU hybrid scheduling for numerical workloads on Apple Silicon.

AstraCompute is a full-stack systems project that routes compute-heavy tasks across a parallel CPU worker pool and a simulated GPU execution lane, learns from historical performance, and exposes live system behavior through a multi-page control dashboard. It was designed as a production-minded demonstration of systems engineering, backend orchestration, performance-aware scheduling, and modern frontend product design.

## Live Links

- Live Demo: [https://astracompute.onrender.com]
- Backend API: [https://astracompute-backend.onrender.com]
- Repository: [https://github.com/Amrutha-space/AstraCompute]


## Why This Project Stands Out

- Built as a real monorepo with a shared core engine, backend service, and product-style frontend
- Uses adaptive scheduling logic instead of static routing rules alone
- Executes CPU workloads in parallel with worker threads
- Preserves task, benchmark, and policy state with SQLite persistence
- Streams live telemetry to the UI with server-sent events
- Includes operator workflows such as auth, queue control, retries, benchmarks, policy governance, and system checks

## Product Overview

AstraCompute accepts vector and matrix workloads, scores them against scheduling heuristics and historical timings, dispatches them to the most appropriate execution lane, and visualizes the result in real time.

The system is intentionally split into focused product surfaces instead of one overloaded dashboard:

- `Home`: branded entry experience and product framing
- `Access`: sign up and sign in flow for local operators
- `Overview`: live system summary and queue health
- `Jobs`: task submission, queue inspection, lifecycle actions
- `Benchmarks`: CPU vs GPU performance analysis and historical snapshots
- `Policies`: scheduler mode selection and governance controls
- `System`: readiness checks, demo load, and operational reset tools

## Architecture

```mermaid
flowchart LR
    UI["React + Vite Frontend"] -->|REST /api| API["Express + TypeScript API"]
    UI -->|SSE /api/stream| API
    API --> AUTH["Local Auth + Sessions"]
    API --> QUEUE["Task Queue"]
    QUEUE --> SCHED["Adaptive Scheduler"]
    SCHED --> CPU["CPU Worker Pool"]
    SCHED --> GPU["Simulated GPU Lane"]
    CPU --> STORE["Metrics + Decision Store"]
    GPU --> STORE
    STORE --> SQLITE["SQLite"]
    STORE --> CSV["logs.csv"]
```

## Core Technical Features

- Parallel CPU execution for vector addition and matrix multiplication
- Simulated GPU lane with pluggable abstraction for future Metal or WebGPU support
- Adaptive scheduler that combines heuristics with historical execution timings
- Policy modes: `balanced`, `latency`, `throughput`, `cpu_preferred`
- Task lifecycle controls: submit, cancel, retry, pause queue, resume queue
- Decision-trace persistence for explainability
- Benchmark snapshots and policy comparison
- Local authentication with sign up, sign in, and session restore
- SQLite-backed restart recovery and historical state retention

## Tech Stack

- Frontend: React, Vite, TypeScript, TailwindCSS, Framer Motion, Recharts
- Backend: Node.js, Express, TypeScript
- Core engine: shared scheduler, task models, kernels, execution contracts
- Persistence: SQLite and CSV logging
- Deployment: Render static site + Render web service

## Local Development

### Requirements

- Node.js 20+
- npm 10+
- macOS Apple Silicon recommended, though the stack is standard Node/React

### Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

Demo operator credentials:

- Email: `demo@astracompute.local`
- Password: `AstraDemo123!`

Useful commands:

```bash
npm run test
npm run build
npm --workspace backend run start
```

## Deployment

### Recommended Hosting

- Frontend: Render Static Site
- Backend: Render Web Service

### Frontend Environment Variable

```bash
VITE_API_URL=https://your-backend-url.onrender.com/api
```

### Backend Environment Variables

```bash
NODE_VERSION=20
PORT=10000
DB_FILE=/tmp/astra.db
LOG_FILE=/tmp/logs.csv
FRONTEND_ORIGIN=https://your-frontend-url.onrender.com
```

## API Highlights

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `POST /api/tasks`
- `POST /api/tasks/seed`
- `POST /api/tasks/:id/cancel`
- `POST /api/tasks/:id/retry`
- `GET /api/benchmarks`
- `POST /api/benchmarks/snapshots`
- `POST /api/policy`
- `POST /api/policy/lock`
- `GET /api/executors`
- `POST /api/system/reset-history`
- `GET /api/stream`


Run:

```bash
npm run test
```

Author - Amrutha 
Built for engineers to ENGINEER.