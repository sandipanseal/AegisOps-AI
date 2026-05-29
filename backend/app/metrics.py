from prometheus_client import Counter, Histogram, Gauge

INCIDENTS_CREATED = Counter("aegisops_incidents_created_total", "Total incidents created", ["severity", "service"])
INCIDENT_STATUS = Gauge("aegisops_incidents_by_status", "Current incidents by status", ["status"])
RCA_REQUESTS = Counter("aegisops_rca_requests_total", "Total RCA analyses requested")
RCA_LATENCY = Histogram("aegisops_rca_latency_seconds", "Latency of RCA analysis")
AGENT_LATENCY = Histogram("aegisops_agent_latency_seconds", "Agent execution latency", ["agent"])
RUNBOOK_EXECUTIONS = Counter("aegisops_runbook_executions_total", "Total runbook executions", ["runbook"])
RUNBOOK_REJECTIONS = Counter("aegisops_runbook_rejections_total", "Total runbook executions rejected")
AI_CONFIDENCE_SCORE = Gauge("aegisops_ai_confidence_score", "Latest AI RCA confidence score")
TOOL_FAILURES = Counter("aegisops_tool_failures_total", "Tool failures by tool name", ["tool"])
EVAL_SCORE = Gauge("aegisops_latest_eval_score", "Latest benchmark evaluation score")
INFEROPS_CALLS = Counter("aegisops_inferops_calls_total", "Total InferOps AI gateway calls", ["status"])
DEMO_SERVICE_FAILURES = Counter("aegisops_demo_service_failures_total", "Failures injected into demo services", ["service", "mode"])
