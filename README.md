# AegisOps AI - Agentic AI Incident Commander for Production Systems

AegisOps AI is a portfolio-grade GenAI/SRE project that demonstrates how agentic AI can support production incident response. It performs incident intake, multi-agent evidence collection, root-cause analysis, safety-gated runbook execution, postmortem generation, RCA evaluation and observability.

## What is upgraded in this version

- Multi-agent workflow: log, metrics, Kubernetes, deployment-history and RCA agents
- Scenario library with multiple realistic production incidents
- Incident detail API with evidence, agent traces, runbooks, timeline and postmortem
- Human approval and idempotency for risky runbook actions
- AI-generated postmortem in Markdown
- RCA benchmark evaluation endpoint
- Prometheus metrics for incidents, RCA latency, agent latency, confidence, eval score and runbooks
- Grafana dashboard provisioning
- Cleaner Next.js UI with tabs for overview, evidence, agents, timeline, postmortem and evals

## Architecture

```text
Frontend Next.js
   -> FastAPI backend
      -> Incident service
      -> Agentic RCA workflow
      -> Evidence collectors
      -> Runbook executor
      -> Postmortem generator
      -> Evaluation service
      -> PostgreSQL
      -> Prometheus / Grafana
```

## Run locally

From the repository root:

```powershell
docker compose --env-file .env -f deployment\docker-compose.yml up --build
```

Or, if you do not need values from the root `.env` file:

```powershell
docker compose -f deployment\docker-compose.yml up --build
```

Open:

- Frontend: http://localhost:3000
- Backend Docs: http://localhost:8000/docs
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

Grafana login:

```text
admin / admin
```

Dashboard:

```text
AegisOps AI Overview
```

## Demo workflow

1. Select a scenario, for example `Payment API latency spike`.
2. Click **Create Scenario**.
3. Click **Run Agentic RCA**.
4. Review RCA, evidence and agent traces.
5. Click **Approve Restart** to simulate a safety-gated runbook.
6. Click **Generate Postmortem**.
7. Click **Run Eval Benchmark**.
8. Check Grafana for RCA latency, agent latency, eval score and runbook metrics.

## API examples

PowerShell uses `curl` as an alias for `Invoke-WebRequest`, so either use `Invoke-RestMethod` or call `curl.exe` explicitly. For multi-line PowerShell commands, use `` ` `` instead of a Bash backslash.

Create scenario incident:

```powershell
$incident = Invoke-RestMethod `
  -Uri "http://localhost:8000/incidents/from-scenario/payment_pool_regression" `
  -Method Post

$incident
```

Run RCA:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:8000/incidents/$($incident.id)/analyze" `
  -Method Post
```

Approve runbook:

```powershell
$approval = @"
{
  "incident_id": $($incident.id),
  "runbook_name": "restart_service",
  "approved_by": "portfolio-reviewer",
  "approved": true
}
"@

Invoke-RestMethod `
  -Uri "http://localhost:8000/runbooks/approve" `
  -Method Post `
  -ContentType "application/json" `
  -Body $approval
```

Generate postmortem:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:8000/incidents/$($incident.id)/postmortem" `
  -Method Post
```

Run RCA benchmark:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:8000/evals/run-benchmark" `
  -Method Post
```

Equivalent `curl.exe` example:

```powershell
curl.exe -X POST "http://localhost:8000/runbooks/approve" `
  -H "Content-Type: application/json" `
  -d '{"incident_id":1,"runbook_name":"restart_service","approved_by":"portfolio-reviewer","approved":true}'
```

## Portfolio positioning

Use this project as:

> Agentic GenAI platform for production incident response with RCA, evidence collection, safety-gated runbooks, postmortems, evals and SRE observability.

Recommended resume bullet:

> Built AegisOps AI, an agentic GenAI incident-command platform using FastAPI, Next.js, PostgreSQL, Docker, Prometheus and Grafana to automate production incident triage, evidence collection, root-cause analysis, human-approved runbooks, postmortem generation and RCA benchmark evaluation.

## Next advanced improvements

- Replace simulated collectors with real Prometheus, Loki, Kubernetes and GitHub/GitLab APIs
- Route all LLM calls through your deployed InferOps AI gateway
- Add LangGraph orchestration with retry and conditional routing
- Add Slack/Teams incident notifications
- Add RAG over previous postmortems and runbooks
- Add Kubernetes staging execution mode for real restart/rollback simulation
