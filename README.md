# AegisOps AI — Agentic Incident Commander

> Turn production alerts into autonomous, multi-agent incident response — evidence
> collection, root-cause analysis, safety-gated runbooks, postmortems, and continuous
> RCA evaluation, with full Prometheus/Grafana observability.

AegisOps AI is an agentic incident-response platform for production systems. When an
incident is opened, a fleet of specialized agents collects evidence in parallel, an RCA
agent synthesizes a confidence-scored root cause, risky remediations are gated behind
human approval, and the whole timeline is captured, scored, and observable.

It runs alongside an LLM gateway such as **InferOps AI**:

```text
AegisOps AI = the agentic incident-response application
InferOps AI = the LLM routing / safety / RAG / observability gateway
```

When `INFEROPS_AI_URL` is configured, AegisOps routes root-cause synthesis through the
gateway and records provider, model, latency, tokens, and cost. If the gateway is
unavailable, a deterministic fallback keeps the platform fully operational.

![AegisOps AI command center](docs/images/frontend-overview.png)

---

## Table of contents

- [Why AegisOps AI](#why-aegisops-ai)
- [Capabilities](#capabilities)
- [Product tour](#product-tour)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [How to run](#how-to-run)
- [Workflow](#workflow)
- [Fault injection](#fault-injection)
- [Connecting InferOps AI](#connecting-inferops-ai)
- [Integrations](#integrations)
- [Key API endpoints](#key-api-endpoints)
- [Observability metrics](#observability-metrics)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Kubernetes](#kubernetes)

## Why AegisOps AI

When a production service degrades at 3 a.m., the clock starts immediately — but the
response usually doesn't. The cost of an outage scales with how long it takes to
understand it, and most of that time is lost to manual, repetitive work before anyone
even forms a hypothesis.

**The problem with how incidents are handled today:**

- **Evidence is scattered.** The on-call engineer manually pulls logs from one tool,
  metrics from another, pod state from `kubectl`, and the recent deploy history from a
  fourth — under pressure, in parallel, by hand. This is the slowest part of most
  incidents.
- **Root cause depends on who's awake.** Diagnosis leans on tribal knowledge. The
  engineer who has seen this failure before resolves it in minutes; everyone else
  rediscovers it from scratch.
- **Remediation is risky and ad-hoc.** Restarts and rollbacks are run from memory, often
  without a guardrail between "investigating" and "I just made it worse."
- **Postmortems are toil.** Writing them up after the fact is tedious, so they're often
  thin or skipped — and the next incident repeats the last one.
- **Analysis quality is never measured.** No one tracks whether the root cause was
  actually correct, so the process never demonstrably improves.

**How AegisOps AI solves it:**

| Problem | What AegisOps does |
|---|---|
| Scattered evidence | Specialized agents collect logs, metrics, Kubernetes state, deploy history, and similar past incidents **in parallel, automatically**, the moment an incident opens. |
| Diagnosis depends on tribal knowledge | An RCA agent synthesizes all evidence into a **confidence-scored root cause** with recommended actions — consistent regardless of who is on call. |
| Risky manual remediation | Fixes run as **approval-gated runbooks** in simulation mode; nothing touches live infrastructure without explicit human sign-off. |
| Postmortem toil | A structured postmortem is **generated from the full incident record** on demand. |
| Unmeasured quality | Every RCA is **scored against a benchmark** of known incidents, so accuracy is tracked over time. |
| No visibility | Incident, agent, model-cost, and service-health metrics stream to **Prometheus and Grafana** in real time. |

The result is a shorter path from alert to understanding — less time gathering context,
faster and more consistent root cause, safe remediation, and a system that measurably
gets better with every incident.

## Capabilities

- **Multi-agent investigation** — Log, Metrics, Kubernetes-State, Deployment-History,
  and RAG-Memory agents collect evidence in parallel, feeding an RCA agent.
- **Root-cause analysis** — RCA synthesis via the InferOps AI gateway with a confidence
  score, recommended safe actions, and risky actions gated behind human approval.
- **Safety-gated runbooks** — YAML runbooks execute only after explicit approval and run
  in simulation mode, so no live infrastructure is mutated without sign-off.
- **AI-generated postmortems** — structured Markdown postmortems built from the full
  incident context.
- **Continuous RCA evaluation** — a benchmark scores analysis quality against known
  incidents so accuracy is measured and tracked over time.
- **Live observability** — Prometheus metrics, a provisioned Grafana dashboard, Loki log
  search, and OpenTelemetry instrumentation.
- **Real integrations** — Loki, the Kubernetes API adapter, Slack/PagerDuty
  notifications, RAG memory over past incidents and runbooks, and InferOps cost/latency
  tracking.
- **Immersive UI** — a Next.js command center with a live 3D service topology, animated
  workflow, and dedicated incident, evaluation, and integration views.

### Incident operations & reliability

Ten operator-grade capabilities layered on top of the core workflow:

1. **Incident lifecycle workflow** — a validated state machine (`open → acknowledged →
   investigating → identified → mitigating → resolved → closed`) with an audit trail,
   assignment, and reopen support. Illegal transitions are rejected.
2. **SLA tracking** — per-severity acknowledge/resolve budgets with live remaining time,
   breach detection, and fleet-wide compliance, surfaced on a dedicated **/sla** view.
3. **AI confidence explanation** — every RCA score ships with an auditable factor
   breakdown (evidence coverage, signal strength, historical precedent, LLM vs.
   deterministic synthesis) so the number is never opaque.
4. **Runbook risk scoring** — each runbook is scored 0–100 from blast radius,
   reversibility, and data-loss risk, with the factor breakdown shown before approval.
5. **Human RCA feedback** — reviewers rate each RCA and submit corrections; a correction
   is promoted into the eval dataset, closing the quality loop.
6. **Tool failure fallback simulation** — toggle simulated failures of Loki, Kubernetes,
   service HTTP, the InferOps gateway, or RAG to exercise the platform's graceful
   degradation on demand.
7. **Prompt-injection detection in logs** — log lines feeding the RCA prompt are scanned
   against known injection signatures, flagged, and redacted before synthesis.
8. **RCA eval dataset manager** — the benchmark runs over a first-class, editable dataset
   (seeded from scenarios, extendable by hand or from human feedback).
9. **Canary deployment analysis** — compares a canary's golden signals against a baseline
   and returns an automated promote / hold / rollback verdict with reasons.
10. **Service dependency graph** — a tiered dependency map with blast-radius / impact
    analysis showing which services a failure would cascade to.

#### Feature gallery

All ten capabilities are shown below. The incident detail view alone surfaces five of
them — **lifecycle workflow (1)**, **SLA tracking (2)**, **AI confidence explanation (3)**,
**runbook risk scoring (4)**, and **human RCA feedback (5)** — on a single page:

<p align="center">
  <img src="docs/images/incident-lifecycle.png" alt="Incident detail: lifecycle, SLA, confidence breakdown, RCA feedback and runbook risk" width="900" />
</p>

<table>
  <tr>
    <td align="center" width="50%"><b>2 · SLA tracking</b></td>
    <td align="center" width="50%"><b>10 · Service dependency graph</b></td>
  </tr>
  <tr>
    <td><img src="docs/images/sla.png" alt="SLA tracking" /></td>
    <td><img src="docs/images/dependencies.png" alt="Service dependency graph" /></td>
  </tr>
  <tr>
    <td align="center"><b>9 · Canary deployment analysis</b></td>
    <td align="center"><b>8 · RCA eval dataset manager</b></td>
  </tr>
  <tr>
    <td><img src="docs/images/canary.png" alt="Canary deployment analysis" /></td>
    <td><img src="docs/images/eval-dataset.png" alt="RCA eval dataset manager" /></td>
  </tr>
</table>

**6 · Tool-failure fallback simulation** and **7 · prompt-injection detection** live on the
integrations control center:

<p align="center">
  <img src="docs/images/tool-fault-injection.png" alt="Tool-failure fallback simulation and prompt-injection scanning" width="900" />
</p>

## Product tour

### Command center

The home view: triage queue on the left, a live 3D service topology (nodes colored by
health), animated metrics, and the full agentic workflow — open an incident, run RCA,
approve a runbook, generate a postmortem, run a benchmark.

![Command center](docs/images/frontend-overview.png)

### Incident detail

A confidence-scored root cause, the raw evidence records each agent produced, agent
execution traces with latencies, and a chronological timeline.

![Incident detail](docs/images/incident-detail.png)

### Integrations control center

Exercise every live integration from the browser — Loki log search, the Kubernetes
adapter, Slack/PagerDuty notifications, RAG memory, and InferOps model usage.

![Integrations control center](docs/images/integrations.png)

### Evaluation center

Run the RCA benchmark and track correctness scores so analysis quality is held
accountable over time.

![Evaluation center](docs/images/eval-center.png)

### Grafana observability

A provisioned dashboard with live incident, agent, model, and service-health metrics,
refreshing every 5 seconds.

![Grafana dashboard](docs/images/grafana-dashboard.png)

## Architecture

```mermaid
flowchart TD
  UI[Next.js Command Center] --> API[FastAPI Backend]

  %% Persistence and observability
  API --> DB[(PostgreSQL)]
  API --> P[Prometheus]
  API --> Loki[(Loki)]
  P --> Grafana[Grafana Dashboard]

  %% Agentic RCA workflow
  API --> Agents[Agentic RCA Workflow]
  Agents --> LogAgent[Log Analysis]
  Agents --> MetricsAgent[Metrics Analysis]
  Agents --> K8sAgent[Kubernetes State]
  Agents --> DeployAgent[Deployment History]
  Agents --> RagAgent[RAG Memory]
  LogAgent --> Guard[7 Prompt-Injection Guard]
  Guard --> RCAAgent[RCA Synthesis]
  MetricsAgent --> RCAAgent
  K8sAgent --> RCAAgent
  DeployAgent --> RCAAgent
  RagAgent --> RCAAgent
  RCAAgent --> Conf[3 Confidence Explanation]

  %% Model routing with graceful fallback
  RCAAgent --> INF[InferOps AI Gateway]
  INF --> LLM[Routed model]
  INF -. fallback .-> OpenAI[OpenAI direct]
  OpenAI -. fallback .-> Det[Deterministic RCA]

  %% Incident operations and reliability layer
  API --> Ops[Incident Operations Layer]
  Ops --> Life[1 Lifecycle State Machine]
  Life --> SLA[2 SLA Tracking]
  Ops --> Risk[4 Runbook Risk Scoring]
  Risk --> Safety[Safety-Gated Runbooks]
  Conf --> Feedback[5 Human RCA Feedback]
  Feedback --> Eval[8 Eval Dataset and Benchmark]
  Ops --> Canary[9 Canary Analysis]
  Ops --> Graph[10 Service Dependency Graph]
  Ops --> Faults[6 Tool Fault Injector]
  Faults -. degrade .-> Agents

  %% Monitored services
  API --> SVC[Monitored Services]
  Agents --> SVC
  Agents --> Loki
  Canary --> SVC
  Graph --> SVC
  SVC --> Payment[payment-service]
  SVC --> Checkout[checkout-service]
  SVC --> Auth[auth-service]
  SVC --> Reco[recommendation-service]
```

The numbered nodes map to the ten capabilities in
[Incident operations & reliability](#incident-operations--reliability). Evidence
collection degrades gracefully: each agent reads live signals from the monitored services
and Loki when available, and falls back to scenario fixtures otherwise. The **tool fault
injector (6)** can force that degradation on demand, the **prompt-injection guard (7)**
sanitizes log evidence before it reaches the model, and model synthesis itself falls back
from the InferOps gateway to a direct OpenAI call to a deterministic synthesizer — so the
workflow always runs end to end.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | FastAPI, SQLAlchemy, PostgreSQL |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind, Framer Motion, react-three-fiber (3D) |
| Agents | Python agent classes, tool adapters, InferOps AI gateway |
| Monitored services | FastAPI microservices exposing real Prometheus metrics |
| Observability | Prometheus, Grafana, Loki, OpenTelemetry |
| Deployment | Docker Compose, Kubernetes manifests, GitHub Actions |

## How to run

### Prerequisites

- **Docker Desktop** with Compose v2 (the only requirement for the full stack).
- *(Optional, for local dev without Docker)* Python 3.11+ and Node.js 20+.

### 1. Get the code

```bash
git clone <repo-url> aegisops-ai
cd aegisops-ai
```

### 2. (Optional) configure integrations

Everything runs out of the box with deterministic fallbacks. To enable the live LLM
gateway or notifications, create `deployment/.env` (Compose reads it automatically):

```env
# Optional — InferOps AI LLM gateway
INFEROPS_AI_URL=https://your-inferops-url.com
INFEROPS_API_KEY=optional-token
OPENAI_MODEL=gpt-4.1-mini

# Optional — notifications (records simulated events when unset)
SLACK_WEBHOOK_URL=
PAGERDUTY_ROUTING_KEY=
```

`backend/.env.example` lists every supported variable.

### 3. Start the full stack

```powershell
cd deployment
docker compose up --build
```

This launches the backend, frontend, four monitored services, PostgreSQL, Loki,
Prometheus, and Grafana. The first build takes a few minutes; wait until the backend logs
show Uvicorn listening on `:8000`.

> Add `-d` to run detached. To wipe the database and start clean, run
> `docker compose down -v` first.

### 4. Open the app

| Surface | URL |
|---|---|
| Command center | http://localhost:3000 |
| Incident center | http://localhost:3000/incidents |
| SLA tracking | http://localhost:3000/sla |
| Dependency graph | http://localhost:3000/dependencies |
| Canary analysis | http://localhost:3000/canary |
| Evaluation center | http://localhost:3000/evals |
| Integrations | http://localhost:3000/integrations |
| Backend API docs | http://localhost:8000/docs |
| Prometheus | http://localhost:9090 |
| Grafana (admin / admin) | http://localhost:3001 |

### 5. Verify it's healthy

```powershell
curl.exe http://localhost:8000/health      # {"status":"healthy", ... "version":"1.0.0"}
```

Then follow the [Workflow](#workflow) below to drive an incident end to end.

### Run without Docker (local dev)

Useful for hot-reload while developing. Run each in its own terminal:

```powershell
# Backend (needs a reachable PostgreSQL; set DATABASE_URL accordingly)
cd backend
python -m venv .venv; .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev        # http://localhost:3000, talks to the backend on :8000
```

### Stop and reset

```powershell
cd deployment
docker compose down        # stop everything
docker compose down -v     # stop and wipe the PostgreSQL volume (fresh start)
```

## Workflow

1. Open `http://localhost:3000`.
2. Pick a scenario (e.g. **Payment API latency spike**) and click **Open incident**.
3. Click **Run RCA** to launch the agentic workflow.
4. Review the overview, evidence, agents, timeline, postmortem, and evals tabs.
5. Click **Approve restart** to run a safety-gated runbook in simulation mode.
6. Click **Postmortem** to generate a structured writeup.
7. Click **Benchmark** to score RCA quality.
8. Open Grafana to watch the metrics update live.

## Fault injection

The platform ships with a fleet of monitored microservices that emit real Prometheus
metrics and can be driven into realistic failure states. Use the **Fault injection**
controls on `http://localhost:3000/incidents`, or call the backend directly.

> On Windows PowerShell, `curl` is an alias for `Invoke-WebRequest` (which has no `-X`
> flag). Use `curl.exe` or `Invoke-RestMethod` for the `POST` calls below.

```powershell
curl.exe -X POST http://localhost:8000/services/payment-service/simulate-failure
curl.exe http://localhost:8000/services/payment-service/signals
```

Injecting a fault pushes the service's log lines into Loki. During analysis the
`LogAnalysisAgent` searches Loki first and falls back to direct service logs, then to
scenario fixtures.

## Connecting InferOps AI

Set these before starting Compose. Compose reads them from your shell or a `.env` next to
the compose file (`deployment/.env`):

```env
INFEROPS_AI_URL=https://your-inferops-url.com
INFEROPS_API_KEY=optional-token
OPENAI_API_KEY=sk-...        # used as the live-model fallback when no gateway is set
OPENAI_MODEL=gpt-4.1-mini
```

```powershell
cd deployment
docker compose --env-file ..\.env up -d --force-recreate backend
```

Confirm the gateway is enabled and that a call was recorded after running an analysis:

```powershell
docker compose exec backend printenv INFEROPS_AI_URL
Invoke-RestMethod http://localhost:8000/model-usage   # total_calls > 0 when live
```

RCA synthesis prefers `INFEROPS_AI_URL` when a gateway is configured. If the gateway is
unset or unreachable, it falls back to a direct OpenAI call when `OPENAI_API_KEY` is set —
this still records provider/model/latency/token/cost, so `model-usage` populates with live
data. Only when neither a gateway nor an OpenAI key is available does the deterministic
fallback RCA run and `model-usage` stays at zero.

## Integrations

| Integration | What it does | Env |
|---|---|---|
| **Loki** | Real log search; fault injection pushes logs, `LogAnalysisAgent` queries them | `LOKI_URL` |
| **Kubernetes adapter** | `KubernetesStateAgent` reads live pod/deployment state | `ENABLE_K8S_ADAPTER`, `KUBECONFIG_PATH` |
| **Slack / PagerDuty** | Sends notifications on incident creation and RCA completion; records simulated events when keys are unset | `SLACK_WEBHOOK_URL`, `PAGERDUTY_ROUTING_KEY` |
| **RAG memory** | Indexes incidents, RCA reports, evidence, and runbooks; `RagMemoryAgent` retrieves similar history | — |
| **InferOps AI** | RCA synthesis with provider/model/latency/token/cost tracking; falls back to a direct OpenAI call when no gateway is set | `INFEROPS_AI_URL`, `INFEROPS_API_KEY`, `OPENAI_API_KEY` |

The Integrations page (`/integrations`) drives all of these from the browser. The
Kubernetes adapter is off by default and falls back to service-reported Kubernetes
signals when disabled.

## Key API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /scenarios` | List incident scenarios |
| `POST /incidents/from-scenario/{key}` | Open an incident from a scenario |
| `POST /incidents/{id}/analyze` | Run the agentic RCA workflow |
| `GET /incidents/{id}` | Incident detail with evidence, traces, timeline |
| `POST /runbooks/approve` | Approval-gated runbook execution |
| `POST /incidents/{id}/postmortem` | Generate an incident postmortem |
| `POST /evals/run-benchmark` | Run the RCA benchmark |
| `POST /services/{service}/simulate-failure` | Inject a fault and push logs to Loki |
| `GET /logs/search` | Search service logs in Loki |
| `GET /kubernetes/{service}/status` | Query the Kubernetes adapter |
| `GET /model-usage` | InferOps AI cost and latency |
| `GET /metrics` | Prometheus metrics |
| `POST /incidents/{id}/transition` | Drive the incident lifecycle state machine |
| `POST /incidents/{id}/assign` | Assign an incident owner |
| `GET /incidents/{id}/lifecycle` | Lifecycle state, allowed transitions, audit trail |
| `GET /incidents/{id}/sla` · `GET /sla/overview` | SLA budgets, breach state, compliance |
| `GET /incidents/{id}/confidence` | RCA confidence factor breakdown |
| `GET /runbooks/risk` · `GET /runbooks/{name}/risk` | Runbook risk scores |
| `POST /incidents/{id}/rca-feedback` | Submit human RCA feedback / correction |
| `GET /tools/faults` · `POST /tools/{tool}/simulate-failure` | Tool fault injection |
| `POST /logs/scan-injection` | Scan log lines for prompt-injection patterns |
| `GET /evals/dataset` · `POST /evals/dataset` | Manage the RCA eval dataset |
| `POST /canary/analyze` · `GET /canary/analyses` | Canary deployment analysis |
| `GET /services/dependency-graph` · `GET /services/{name}/impact` | Dependency graph & blast radius |

## Observability metrics

```text
aegisops_incidents_created_total
aegisops_rca_requests_total
aegisops_rca_latency_seconds
aegisops_ai_confidence_score
aegisops_runbook_executions_total
aegisops_latest_eval_score
aegisops_service_faults_total
aegisops_model_latency_seconds
aegisops_model_cost_usd_total
aegisops_model_tokens_total
aegisops_notifications_sent_total
aegisops_loki_queries_total
aegisops_k8s_adapter_calls_total
aegisops_rag_queries_total
aegisops_incident_transitions_total
aegisops_sla_breaches_total
aegisops_sla_compliance_ratio
aegisops_time_to_acknowledge_seconds
aegisops_time_to_resolve_seconds
aegisops_runbook_risk_score
aegisops_rca_feedback_total
aegisops_tool_faults_injected_total
aegisops_tool_fallbacks_total
aegisops_prompt_injections_detected_total
aegisops_eval_dataset_cases
aegisops_canary_analyses_total
aegisops_dependency_blast_radius
```

> Prometheus counters live in the backend process, so they reset when the backend
> container is rebuilt. Incident and runbook history is persisted in PostgreSQL and
> always reflected in the UI; re-running a workflow repopulates the counters.

## Testing

All automated tests live under [`Tests/`](Tests/), split by surface:

| Suite | Path | Coverage |
|---|---|---|
| Backend regression | `Tests/backend/` | pytest API suite — health, full incident lifecycle (create → analyze → approve runbook → postmortem), evals, and graceful integration fallbacks. Runs on in-memory SQLite with no external services. |
| Frontend end-to-end | `Tests/e2e/` | Playwright suite — dashboard + 3D topology, navigation, the complete incident workflow, fault injection, benchmark, and integrations. |

### Backend tests

```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cd ..
pytest          # uses pytest.ini -> Tests/backend
```

### Frontend end-to-end tests

Start the stack first (`cd deployment && docker compose up`), then:

```powershell
cd Tests/e2e
npm install
npx playwright install chromium     # one-time
npm run test:e2e                    # or: npm run test:e2e:ui
```

### Continuous integration

Every push to `main` and every pull request runs three jobs in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- **backend-ci** — installs deps, byte-compiles, runs the pytest suite.
- **frontend-ci** — builds and type-checks the Next.js app.
- **e2e** — starts PostgreSQL + the backend + the frontend, runs the Playwright suite,
  and uploads the HTML report as an artifact.

## Project layout

```text
aegisops-ai/
├── backend/            FastAPI app — agents, services, runbooks, metrics
│   └── app/
│       ├── agents/         RCA + safety agents
│       ├── services/       orchestration, evidence collectors, integrations
│       ├── data/           incident scenarios
│       └── runbooks/        YAML runbooks
├── frontend/           Next.js command center
│   ├── app/                routes: command, incidents, evals, integrations
│   ├── components/         UI kit, nav, animated background, 3D topology
│   └── lib/                API client + types, formatting helpers
├── services/           monitored FastAPI microservices (Prometheus metrics)
├── Tests/              automated tests
│   ├── backend/            pytest regression suite
│   └── e2e/                Playwright end-to-end suite
├── observability/      Prometheus, Grafana dashboards, Loki config
└── deployment/         Docker Compose + Kubernetes manifests
```

## Kubernetes

Manifests for the backend, frontend, and monitored services live in
[`deployment/k8s/`](deployment/k8s/). A local Kind walkthrough is in
[`deployment/k8s/KIND_QUICKSTART.md`](deployment/k8s/KIND_QUICKSTART.md).
