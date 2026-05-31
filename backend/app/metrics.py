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
OPENAI_CALLS = Counter("aegisops_openai_calls_total", "Total direct OpenAI chat-completion calls", ["status"])
SERVICE_FAULTS = Counter("aegisops_service_faults_total", "Faults injected into monitored services", ["service", "mode"])

LOKI_QUERIES = Counter("aegisops_loki_queries_total", "Loki log-search queries", ["status"])
K8S_ADAPTER_CALLS = Counter("aegisops_k8s_adapter_calls_total", "Kubernetes adapter calls", ["status"])
NOTIFICATIONS_SENT = Counter("aegisops_notifications_sent_total", "Notifications sent or simulated", ["channel", "status"])
RAG_QUERIES = Counter("aegisops_rag_queries_total", "RAG memory queries", ["source"])
MODEL_LATENCY = Histogram("aegisops_model_latency_seconds", "InferOps/model call latency", ["provider", "model"])
MODEL_COST = Counter("aegisops_model_cost_usd_total", "Accumulated model cost in USD", ["provider", "model"])
MODEL_TOKENS = Counter("aegisops_model_tokens_total", "Model tokens by type", ["provider", "model", "token_type"])

# --- Feature metrics ---
# 1. Incident lifecycle workflow
INCIDENT_TRANSITIONS = Counter("aegisops_incident_transitions_total", "Incident lifecycle transitions", ["from_status", "to_status"])
# 2. SLA tracking
SLA_BREACHES = Counter("aegisops_sla_breaches_total", "SLA breaches by stage and severity", ["stage", "severity"])
SLA_COMPLIANCE = Gauge("aegisops_sla_compliance_ratio", "Fraction of incidents currently within SLA")
TIME_TO_ACKNOWLEDGE = Histogram("aegisops_time_to_acknowledge_seconds", "Time from incident open to acknowledge")
TIME_TO_RESOLVE = Histogram("aegisops_time_to_resolve_seconds", "Time from incident open to resolve")
# 4. Runbook risk scoring
RUNBOOK_RISK_SCORE = Gauge("aegisops_runbook_risk_score", "Computed runbook risk score (0-100)", ["runbook"])
# 5. Human RCA feedback
RCA_FEEDBACK = Counter("aegisops_rca_feedback_total", "Human RCA feedback submissions", ["verdict"])
# 6. Tool failure fallback simulation
TOOL_FAULTS_INJECTED = Counter("aegisops_tool_faults_injected_total", "Tool fault injections toggled", ["tool", "active"])
TOOL_FALLBACKS = Counter("aegisops_tool_fallbacks_total", "Times a tool fell back to a degraded source", ["tool"])
# 7. Prompt-injection detection
PROMPT_INJECTIONS = Counter("aegisops_prompt_injections_detected_total", "Prompt-injection patterns detected in logs", ["severity"])
# 8. RCA eval dataset manager
EVAL_DATASET_SIZE = Gauge("aegisops_eval_dataset_cases", "Active cases in the RCA eval dataset")
# 9. Canary deployment analysis
CANARY_ANALYSES = Counter("aegisops_canary_analyses_total", "Canary deployment analyses by verdict", ["verdict"])
# 10. Service dependency graph
DEPENDENCY_IMPACT = Gauge("aegisops_dependency_blast_radius", "Blast radius (impacted services) for the last impact query", ["service"])
