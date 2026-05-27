from prometheus_client import Counter, Histogram, Gauge

INCIDENTS_CREATED = Counter("aegisops_incidents_created_total", "Total incidents created")
RCA_REQUESTS = Counter("aegisops_rca_requests_total", "Total RCA analyses requested")
RCA_LATENCY = Histogram("aegisops_rca_latency_seconds", "RCA analysis latency")
RUNBOOK_EXECUTIONS = Counter("aegisops_runbook_executions_total", "Total runbook executions")
RUNBOOK_REJECTIONS = Counter("aegisops_runbook_rejections_total", "Total rejected runbook approvals")
TOOL_FAILURES = Counter("aegisops_tool_failures_total", "Total external tool failures", ["tool"])
AI_CONFIDENCE_SCORE = Gauge("aegisops_ai_confidence_score", "Latest RCA confidence score")
