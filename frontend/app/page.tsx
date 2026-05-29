"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Boxes,
  FileText,
  FlaskConical,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  api,
  json,
  SERVICES,
  type DashboardSummary,
  type EvalRun,
  type Incident,
  type IncidentDetail,
  type Scenario,
} from "@/lib/api";
import {
  pct,
  severityTone,
  statusTone,
  timeAgo,
} from "@/lib/format";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  EmptyState,
  JsonBlock,
  Loader,
  Metric,
  SectionTitle,
  Tabs,
} from "@/components/ui";
import type { TopologyNode } from "@/components/ServiceTopology";

const ServiceTopology = dynamic(
  () => import("@/components/ServiceTopology"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
        Initializing topology…
      </div>
    ),
  }
);

const TABS = ["overview", "evidence", "agents", "timeline", "postmortem", "evals"];

export default function CommandCenter() {
  const [summary, setSummary] = useState<Partial<DashboardSummary>>({});
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("payment_pool_regression");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [evals, setEvals] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [tab, setTab] = useState("overview");

  const activeIncident = useMemo(
    () => detail?.incident || incidents.find((x) => x.id === activeId) || null,
    [detail, incidents, activeId]
  );

  const topologyNodes: TopologyNode[] = useMemo(() => {
    return SERVICES.map((name) => {
      const related = incidents.filter((i) => i.service_name === name);
      const active = activeIncident?.service_name === name;
      const unresolved = related.find((i) => i.status !== "resolved");
      let tone: TopologyNode["tone"] = "healthy";
      if (active && unresolved) tone = "active";
      else if (unresolved)
        tone = unresolved.severity === "critical" || unresolved.severity === "high" ? "critical" : "warn";
      return { name, tone };
    });
  }, [incidents, activeIncident]);

  async function refreshAll(id?: number | null) {
    const [summaryData, scenariosData, incidentsData, evalsData] = await Promise.all([
      api<DashboardSummary>("/dashboard/summary"),
      api<Scenario[]>("/scenarios"),
      api<Incident[]>("/incidents"),
      api<EvalRun[]>("/evals"),
    ]);
    setSummary(summaryData);
    setScenarios(scenariosData);
    setIncidents(incidentsData);
    setEvals(evalsData);
    const targetId = id ?? activeId ?? incidentsData[0]?.id ?? null;
    if (targetId) {
      setActiveId(targetId);
      setDetail(await api<IncidentDetail>(`/incidents/${targetId}`));
    }
  }

  useEffect(() => {
    refreshAll().catch(() =>
      setMessage({
        kind: "err",
        text: "Backend unreachable. Wait for the stack to finish starting, then refresh.",
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setMessage(null);
    try {
      await action();
    } catch (err: any) {
      setMessage({ kind: "err", text: err.message || "Request failed" });
    }
    setLoading(false);
  }

  const createScenarioIncident = () =>
    run(async () => {
      const incident = await api<Incident>(
        `/incidents/from-scenario/${selectedScenario}`,
        { method: "POST" }
      );
      await refreshAll(incident.id);
      setTab("overview");
      setMessage({ kind: "ok", text: `Opened incident #${incident.id}: ${incident.title}` });
    });

  const analyzeIncident = () =>
    run(async () => {
      if (!activeIncident) return;
      await api(`/incidents/${activeIncident.id}/analyze`, { method: "POST" });
      await refreshAll(activeIncident.id);
      setTab("evidence");
      setMessage({ kind: "ok", text: "Agentic RCA complete — evidence, traces and root cause stored." });
    });

  const approveRunbook = (runbookName: string) =>
    run(async () => {
      if (!activeIncident || activeIncident.status === "resolved") return;
      const result = await api<{ status: string }>(
        "/runbooks/approve",
        json({
          incident_id: activeIncident.id,
          runbook_name: runbookName,
          approved_by: "sre-oncall",
          approved: true,
        })
      );
      await refreshAll(activeIncident.id);
      setTab("timeline");
      setMessage({ kind: "ok", text: `Runbook ${runbookName}: ${result.status} (simulation mode).` });
    });

  const generatePostmortem = () =>
    run(async () => {
      if (!activeIncident) return;
      await api(`/incidents/${activeIncident.id}/postmortem`, { method: "POST" });
      await refreshAll(activeIncident.id);
      setTab("postmortem");
      setMessage({ kind: "ok", text: "Postmortem generated and stored." });
    });

  const runBenchmark = () =>
    run(async () => {
      const result = await api<{ passed_cases: number; total_cases: number }>(
        "/evals/run-benchmark",
        { method: "POST" }
      );
      await refreshAll(activeId);
      setTab("evals");
      setMessage({
        kind: "ok",
        text: `RCA benchmark finished: ${result.passed_cases}/${result.total_cases} passed.`,
      });
    });

  return (
    <main className="mx-auto w-full max-w-7xl overflow-x-clip px-5 pb-20 pt-8 md:px-8">
      {/* Hero */}
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card delay={0} className="flex min-w-0 flex-col justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" /> Agentic Incident Commander
            </span>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              Resolve production incidents{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-violet-glow bg-clip-text text-transparent">
                with autonomous agents
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-slate-300">
              AegisOps turns alerts into multi-agent evidence collection, root-cause
              analysis, safety-gated runbooks, postmortems, and continuous RCA
              evaluation — backed by InferOps AI and a full observability stack.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="min-w-[230px] flex-1 rounded-2xl border border-white/10 bg-ink-900/80 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
            >
              {scenarios.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title} · {s.service_name}
                </option>
              ))}
            </select>
            <Button onClick={createScenarioIncident} disabled={loading}>
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> Open incident
              </span>
            </Button>
            <Button variant="ghost" onClick={analyzeIncident} disabled={!activeIncident || loading}>
              <span className="inline-flex items-center gap-2">
                <Play className="h-4 w-4" /> Run RCA
              </span>
            </Button>
            <Button variant="ghost" onClick={runBenchmark} disabled={loading}>
              <span className="inline-flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Benchmark
              </span>
            </Button>
          </div>
        </Card>

        <Card delay={0.08} className="min-w-0 overflow-hidden p-0">
          <ServiceTopology nodes={topologyNodes} />
        </Card>
      </section>

      {/* Toast */}
      <AnimatePresence>
        {(message || loading) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
              loading
                ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-200"
                : message?.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                : "border-rose-500/30 bg-rose-500/5 text-rose-200"
            }`}
          >
            {loading ? <Loader label="Agents working" /> : <span>{message?.text}</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total incidents" value={<AnimatedNumber value={summary.total_incidents ?? 0} />} delay={0.02} />
        <Metric label="Open" value={<AnimatedNumber value={summary.open ?? 0} />} delay={0.04} />
        <Metric label="Investigating" value={<AnimatedNumber value={summary.investigating ?? 0} />} delay={0.06} />
        <Metric label="Resolved" value={<AnimatedNumber value={summary.resolved ?? 0} />} delay={0.08} accent />
        <Metric label="Agent traces" value={<AnimatedNumber value={summary.agent_traces ?? 0} />} delay={0.1} />
        <Metric
          label="Latest eval"
          value={pct(summary.latest_eval_score)}
          hint={summary.model_cost_usd != null ? `model spend $${summary.model_cost_usd}` : undefined}
          delay={0.12}
          accent
        />
      </section>

      {/* Main grid */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* Queue */}
        <Card delay={0.05} className="h-fit min-w-0">
          <SectionTitle eyebrow="Triage" title="Incident queue" />
          <div className="space-y-2.5">
            {incidents.length === 0 && (
              <EmptyState>No incidents yet. Open a scenario to start the workflow.</EmptyState>
            )}
            {incidents.map((incident) => {
              const active = activeId === incident.id;
              return (
                <button
                  key={incident.id}
                  onClick={() => {
                    setActiveId(incident.id);
                    setTab("overview");
                    run(async () => setDetail(await api(`/incidents/${incident.id}`)));
                  }}
                  className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
                    active
                      ? "border-cyan-400/50 bg-cyan-400/[0.06]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">
                      #{incident.id} {incident.title}
                    </p>
                    <Badge tone={statusTone(incident.status)}>{incident.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Badge tone={severityTone(incident.severity)}>{incident.severity}</Badge>
                    <span className="truncate">{incident.service_name}</span>
                    <span className="ml-auto">{timeAgo(incident.created_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Detail */}
        <div className="min-w-0 space-y-5">
          {!activeIncident && (
            <Card delay={0.08}>
              <EmptyState>
                Select an incident or open a scenario to launch the agentic RCA workflow.
              </EmptyState>
            </Card>
          )}

          {activeIncident && detail && (
            <>
              <Card delay={0.08}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{activeIncident.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <span className="font-mono text-cyan-300">{activeIncident.service_name}</span>
                      <Badge tone={severityTone(activeIncident.severity)}>{activeIncident.severity}</Badge>
                      <Badge tone={statusTone(activeIncident.status)}>{activeIncident.status}</Badge>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{activeIncident.description}</p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Button onClick={analyzeIncident} disabled={loading}>
                    <span className="inline-flex items-center gap-2"><Play className="h-4 w-4" /> Run / re-run RCA</span>
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => approveRunbook("restart_service")}
                    disabled={activeIncident.status === "resolved" || loading}
                  >
                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Approve restart</span>
                  </Button>
                  <Button variant="ghost" onClick={generatePostmortem} disabled={loading}>
                    <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Postmortem</span>
                  </Button>
                </div>
              </Card>

              <Tabs tabs={TABS} active={tab} onChange={setTab} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {tab === "overview" && <Overview detail={detail} />}
                  {tab === "evidence" && <EvidenceView detail={detail} />}
                  {tab === "agents" && <AgentsView detail={detail} />}
                  {tab === "timeline" && <TimelineView detail={detail} />}
                  {tab === "postmortem" && <PostmortemView detail={detail} />}
                  {tab === "evals" && <EvalsView evals={evals} />}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function ConfidenceRing({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <motion.circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - c * score }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-cyan-300">
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

function Overview({ detail }: { detail: IncidentDetail }) {
  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle eyebrow="Synthesis" title="Root-cause analysis" />
        {!detail.rca ? (
          <EmptyState>RCA not generated yet — run the agentic workflow.</EmptyState>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <ConfidenceRing score={detail.rca.confidence_score} />
            <p className="text-sm leading-7 text-slate-200">{detail.rca.suspected_root_cause}</p>
          </div>
        )}
      </Card>
      {detail.rca && (
        <Card>
          <SectionTitle eyebrow="Remediation" title="Action plan" />
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Safe actions
              </p>
              <ul className="space-y-1.5 text-sm text-slate-300">
                {detail.rca.recommended_actions.map((a) => (
                  <li key={a} className="rounded-lg border border-emerald-500/10 bg-emerald-500/[0.04] px-3 py-2">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-300">
                <AlertTriangle className="h-4 w-4" /> Requires human approval
              </p>
              <ul className="space-y-1.5 text-sm text-slate-300">
                {detail.rca.risky_actions.map((a) => (
                  <li key={a} className="rounded-lg border border-rose-500/10 bg-rose-500/[0.04] px-3 py-2">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function EvidenceView({ detail }: { detail: IncidentDetail }) {
  return (
    <Card>
      <SectionTitle eyebrow="Signals" title="Evidence collected by agents" />
      {detail.evidence.length === 0 ? (
        <EmptyState>No evidence yet — run RCA first.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {detail.evidence.map((item) => (
            <div key={item.source} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="font-mono text-sm font-bold text-cyan-300">{item.source}</p>
              <p className="mt-1 text-sm text-slate-300">{item.summary}</p>
              <JsonBlock data={item.details} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AgentsView({ detail }: { detail: IncidentDetail }) {
  return (
    <Card>
      <SectionTitle eyebrow="Execution" title="Agent traces" />
      {detail.agent_traces.length === 0 ? (
        <EmptyState>No agent traces yet.</EmptyState>
      ) : (
        <div className="space-y-2.5">
          {detail.agent_traces.map((t, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-white">
                  <Boxes className="h-4 w-4 text-cyan-300" /> {t.agent_name}
                </span>
                <span className="flex items-center gap-3 text-xs text-slate-400">
                  <Badge tone={t.status === "success" ? "resolved" : "high"}>{t.status}</Badge>
                  {Math.round(t.latency_ms)} ms
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{t.output_summary}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TimelineView({ detail }: { detail: IncidentDetail }) {
  return (
    <Card>
      <SectionTitle eyebrow="History" title="Timeline & runbooks" />
      <ol className="relative space-y-3 border-l border-white/10 pl-5">
        {detail.timeline.map((t, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-400 ring-4 ring-ink-950" />
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-sm font-semibold text-white">
                {t.event_type} · <span className="text-cyan-300">{t.actor}</span>
              </p>
              <p className="text-sm text-slate-300">{t.message}</p>
              <p className="mt-1 text-xs text-slate-500">{timeAgo(t.created_at)}</p>
            </div>
          </li>
        ))}
      </ol>
      <h3 className="mt-6 mb-3 text-sm font-bold text-slate-200">Runbook executions</h3>
      {detail.runbooks.length === 0 ? (
        <EmptyState>No runbooks executed yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {detail.runbooks.map((r, i) => (
            <div key={i} className="rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-3">
              <p className="text-sm font-semibold text-rose-200">
                {r.runbook_name} · {r.status}
              </p>
              <p className="text-xs text-slate-400">approved by {r.approved_by} · {timeAgo(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PostmortemView({ detail }: { detail: IncidentDetail }) {
  return (
    <Card>
      <SectionTitle eyebrow="Learning" title="Generated postmortem" />
      {!detail.postmortem ? (
        <EmptyState>No postmortem yet — generate one from the actions above.</EmptyState>
      ) : (
        <pre className="whitespace-pre-wrap rounded-2xl border border-white/5 bg-ink-950/70 p-5 text-sm leading-7 text-slate-200">
          {detail.postmortem}
        </pre>
      )}
    </Card>
  );
}

function EvalsView({ evals }: { evals: EvalRun[] }) {
  return (
    <Card>
      <SectionTitle eyebrow="Quality" title="RCA evaluation runs" />
      {evals.length === 0 ? (
        <EmptyState>No eval runs yet — run a benchmark.</EmptyState>
      ) : (
        <div className="space-y-3">
          {evals.map((e, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">{e.name}</p>
                <span className="text-lg font-black text-cyan-300">{pct(e.score)}</span>
              </div>
              <p className="text-xs text-slate-400">
                {e.passed_cases}/{e.total_cases} cases passed · {timeAgo(e.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
