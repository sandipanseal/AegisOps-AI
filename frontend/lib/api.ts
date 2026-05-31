export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export const GRAFANA_URL =
  process.env.NEXT_PUBLIC_GRAFANA_URL ||
  "http://localhost:3001/d/aegisops-overview/aegisops-ai-overview?orgId=1&refresh=5s";

export async function api<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers:
      options?.body && !(options.headers as any)?.["Content-Type"]
        ? { "Content-Type": "application/json", ...(options?.headers || {}) }
        : options?.headers,
    ...options,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error((data && (data.detail || data.message)) || "Request failed");
  }
  return data as T;
}

export const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ---- Domain types ----

export type Incident = {
  id: number;
  title: string;
  description: string;
  service_name: string;
  severity: string;
  status: string;
  scenario_key: string;
  assignee?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Scenario = {
  key: string;
  title: string;
  service_name: string;
  severity: string;
  description: string;
};

export type Evidence = {
  source: string;
  summary: string;
  details: Record<string, any>;
};

export type AgentTrace = {
  agent_name: string;
  status: string;
  latency_ms: number;
  input_summary?: string;
  output_summary: string;
  created_at: string;
};

export type ConfidenceFactor = {
  label: string;
  delta: number;
  detail: string;
};

export type ConfidenceExplanation = {
  score: number;
  summary: string;
  factors: ConfidenceFactor[];
};

export type RCA = {
  suspected_root_cause: string;
  confidence_score: number;
  recommended_actions: string[];
  risky_actions: string[];
  requires_human_approval: boolean;
  confidence_explanation?: ConfidenceExplanation | null;
  created_at: string;
};

export type RunbookRun = {
  runbook_name: string;
  approved_by: string;
  status: string;
  result: string;
  risk_score?: number | null;
  created_at: string;
};

export type TimelineEvent = {
  event_type: string;
  message: string;
  actor: string;
  created_at: string;
};

export type IncidentDetail = {
  incident: Incident;
  evidence: Evidence[];
  agent_traces: AgentTrace[];
  rca: RCA | null;
  runbooks: RunbookRun[];
  timeline: TimelineEvent[];
  postmortem: string | null;
};

export type DashboardSummary = {
  total_incidents: number;
  open: number;
  investigating: number;
  resolved: number;
  runbook_executions: number;
  agent_traces: number;
  latest_ai_confidence: number | null;
  latest_eval_score: number | null;
  model_invocations: number;
  model_cost_usd: number;
  notifications: number;
};

export type EvalRun = {
  name: string;
  total_cases: number;
  passed_cases: number;
  score: number;
  created_at: string;
  details: any;
};

export const SERVICES = [
  "payment-service",
  "checkout-service",
  "auth-service",
  "recommendation-service",
] as const;

// ---- Feature domain types ----

// 1. Incident lifecycle workflow
export type LifecycleTransition = {
  from_status: string;
  to_status: string;
  actor: string;
  note?: string | null;
  created_at?: string | null;
};

export type Lifecycle = {
  incident_id: number;
  status: string;
  assignee?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  allowed_next: string[];
  states: string[];
  transitions: LifecycleTransition[];
};

// 2. SLA tracking
export type SlaStage = {
  budget_minutes: number;
  deadline: string;
  completed_at?: string | null;
  elapsed_seconds: number;
  remaining_seconds: number | null;
  breached: boolean;
  status: "on_track" | "at_risk" | "breached" | "met";
};

export type IncidentSla = {
  incident_id: number;
  severity: string;
  policy: { ack_minutes: number; resolve_minutes: number };
  acknowledge: SlaStage;
  resolve: SlaStage;
  within_sla: boolean;
};

export type SlaOverview = {
  total_incidents: number;
  within_sla: number;
  ack_breaches: number;
  resolve_breaches: number;
  compliance_ratio: number;
  policies: Record<string, { ack_minutes: number; resolve_minutes: number }>;
  incidents: Array<{
    incident_id: number;
    title: string;
    service_name: string;
    severity: string;
    status: string;
    within_sla: boolean;
    acknowledge: SlaStage;
    resolve: SlaStage;
  }>;
};

// 4. Runbook risk scoring
export type RunbookRiskFactor = { label: string; value: string; points: number };
export type RunbookRisk = {
  runbook: string;
  key?: string;
  description?: string;
  risk_score: number;
  risk_band: "low" | "medium" | "high";
  requires_approval: boolean;
  recovery_minutes?: number | null;
  factors: RunbookRiskFactor[];
};

// 5. Human RCA feedback
export type RcaFeedback = {
  id: number;
  incident_id: number;
  rca_id?: number | null;
  verdict: string;
  rating?: number | null;
  corrected_root_cause?: string | null;
  comment?: string | null;
  reviewer: string;
  promoted_to_eval: boolean;
  created_at?: string | null;
};

// 6. Tool failure fallback simulation
export type ToolFault = { tool: string; active: boolean; fallback: string };

// 7. Prompt-injection detection
export type InjectionDetection = {
  id?: number;
  incident_id?: number | null;
  source: string;
  line: string;
  pattern: string;
  severity: string;
  created_at?: string | null;
};

export type InjectionScanResult = {
  scanned_lines: number;
  detections: InjectionDetection[];
  highest_severity: string | null;
  sanitized_lines: string[];
};

// 8. RCA eval dataset manager
export type EvalCase = {
  id: number;
  key: string;
  title: string;
  service_name: string;
  severity: string;
  description: string;
  expected_root_cause: string;
  logs: string[];
  source: string;
  active: boolean;
  created_at?: string | null;
};

// 9. Canary deployment analysis
export type CanaryReason = { signal: string; verdict: string; detail: string };
export type CanaryMetricsT = {
  p95_latency_ms: number;
  error_rate_pct: number;
  cpu_pct: number;
  memory_pct: number;
};
export type CanaryAnalysis = {
  id: number;
  incident_id?: number | null;
  service_name: string;
  verdict: "promote" | "hold" | "rollback";
  score: number;
  baseline: CanaryMetricsT;
  canary: CanaryMetricsT;
  reasons: CanaryReason[];
  created_at?: string | null;
};

// 10. Service dependency graph
export type DependencyNode = {
  name: string;
  tier: string;
  kind: string;
  criticality: string;
  depends_on: string[];
  depended_on_by: string[];
  active_incidents: Array<{ id: number; title: string; severity: string; status: string }>;
  health: "healthy" | "degraded";
};

export type DependencyGraph = {
  nodes: DependencyNode[];
  edges: Array<{ source: string; target: string }>;
};

export type ServiceImpact = {
  service: string;
  blast_radius: number;
  impacted_services: string[];
  direct_dependents: string[];
  depends_on: string[];
  impacted_with_active_incidents: string[];
};
