"use client";

import { useEffect, useMemo, useState } from "react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Incident = {
  id: number;
  title: string;
  description: string;
  service_name: string;
  severity: string;
  status: string;
  scenario_key: string;
  created_at?: string;
};

type Scenario = {
  key: string;
  title: string;
  service_name: string;
  severity: string;
  description: string;
};

type Detail = {
  incident: Incident;
  evidence: any[];
  agent_traces: any[];
  rca: any | null;
  runbooks: any[];
  timeline: any[];
  postmortem: string | null;
};

export default function Home() {
  const [summary, setSummary] = useState<any>({});
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("payment_pool_regression");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [evals, setEvals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("overview");

  const activeIncident = useMemo(() => detail?.incident || incidents.find((x) => x.id === activeId) || null, [detail, incidents, activeId]);

  async function api(path: string, options?: RequestInit) {
    const response = await fetch(`${backendUrl}${path}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Request failed");
    return data;
  }

  async function refreshAll(id?: number | null) {
    const [summaryData, scenariosData, incidentsData, evalsData] = await Promise.all([
      api("/dashboard/summary"),
      api("/scenarios"),
      api("/incidents"),
      api("/evals"),
    ]);
    setSummary(summaryData);
    setScenarios(scenariosData);
    setIncidents(incidentsData);
    const targetId = id ?? activeId ?? incidentsData[0]?.id ?? null;
    if (targetId) {
      setActiveId(targetId);
      setDetail(await api(`/incidents/${targetId}`));
    }
    setEvals(evalsData);
  }

  useEffect(() => {
    refreshAll().catch(() => setMessage("Backend is not reachable yet. Wait for Docker containers to finish starting."));
  }, []);

  async function createScenarioIncident() {
    setLoading(true); setMessage("");
    try {
      const incident = await api(`/incidents/from-scenario/${selectedScenario}`, { method: "POST" });
      await refreshAll(incident.id);
      setTab("overview");
      setMessage(`Created incident #${incident.id}: ${incident.title}`);
    } catch (err: any) { setMessage(err.message); }
    setLoading(false);
  }

  async function analyzeIncident() {
    if (!activeIncident) return;
    setLoading(true); setMessage("");
    try {
      await api(`/incidents/${activeIncident.id}/analyze`, { method: "POST" });
      await refreshAll(activeIncident.id);
      setTab("evidence");
      setMessage("Agentic RCA completed. Evidence, traces and RCA were stored.");
    } catch (err: any) { setMessage(err.message); }
    setLoading(false);
  }

  async function approveRunbook(runbookName: string) {
    if (!activeIncident || activeIncident.status === "resolved") return;
    setLoading(true); setMessage("");
    try {
      const result = await api("/runbooks/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_id: activeIncident.id, runbook_name: runbookName, approved_by: "portfolio-reviewer", approved: true }),
      });
      await refreshAll(activeIncident.id);
      setTab("timeline");
      setMessage(`Runbook result: ${result.status}. Safety mode did not modify real infrastructure.`);
    } catch (err: any) { setMessage(err.message); }
    setLoading(false);
  }

  async function generatePostmortem() {
    if (!activeIncident) return;
    setLoading(true); setMessage("");
    try {
      await api(`/incidents/${activeIncident.id}/postmortem`, { method: "POST" });
      await refreshAll(activeIncident.id);
      setTab("postmortem");
      setMessage("Postmortem generated and stored.");
    } catch (err: any) { setMessage(err.message); }
    setLoading(false);
  }

  async function runBenchmark() {
    setLoading(true); setMessage("");
    try {
      const result = await api("/evals/run-benchmark", { method: "POST" });
      await refreshAll(activeId);
      setTab("evals");
      setMessage(`RCA benchmark finished: ${result.passed_cases}/${result.total_cases} passed.`);
    } catch (err: any) { setMessage(err.message); }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-7 shadow-2xl">
          <p className="text-sm font-semibold tracking-widest text-cyan-300">AGENTIC AI INCIDENT COMMANDER</p>
          <h1 className="mt-3 text-4xl md:text-6xl font-black">AegisOps AI</h1>
          <p className="mt-4 max-w-4xl text-slate-300"> GenAI / SRE platform for incident intake, multi-agent evidence collection, RCA, safety-gated runbooks, postmortems, evals and observability.</p>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto_auto]">
            <select value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
              {scenarios.map((scenario) => <option key={scenario.key} value={scenario.key}>{scenario.title} · {scenario.service_name}</option>)}
            </select>
            <Button onClick={createScenarioIncident}>Create Scenario</Button>
            <Button onClick={analyzeIncident} disabled={!activeIncident || loading}>Run Agentic RCA</Button>
            <Button onClick={runBenchmark}>Run Eval Benchmark</Button>
            <a href="/incidents" className="rounded-2xl border border-slate-700 px-5 py-3 text-center font-bold hover:bg-slate-800">Incident Center</a>
            <a href="/evals" className="rounded-2xl border border-slate-700 px-5 py-3 text-center font-bold hover:bg-slate-800">Evals</a>
            <a href="http://localhost:3001/d/aegisops-overview/aegisops-ai-overview?orgId=1&refresh=5s" target="_blank" className="rounded-2xl border border-slate-700 px-5 py-3 text-center font-bold hover:bg-slate-800">Grafana</a>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-emerald-800 bg-emerald-950/60 p-4 text-emerald-200">{message}</div>}
        {loading && <div className="rounded-2xl border border-yellow-700 bg-yellow-950/60 p-4 text-yellow-200">Processing...</div>}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <Metric label="Total Incidents" value={summary.total_incidents ?? 0} />
          <Metric label="Open" value={summary.open ?? 0} />
          <Metric label="Investigating" value={summary.investigating ?? 0} />
          <Metric label="Resolved" value={summary.resolved ?? 0} />
          <Metric label="Agent Traces" value={summary.agent_traces ?? 0} />
          <Metric label="Latest Eval" value={summary.latest_eval_score == null ? "--" : `${Math.round(summary.latest_eval_score * 100)}%`} />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-2xl font-bold">Incident Queue</h2>
            <div className="mt-4 space-y-3">
              {incidents.length === 0 && <p className="text-slate-400">No incidents yet. Create a scenario incident.</p>}
              {incidents.map((incident) => (
                <button key={incident.id} onClick={() => { setActiveId(incident.id); setTab("overview"); refreshAll(incident.id); }} className={`w-full rounded-2xl border p-4 text-left hover:border-cyan-500 ${activeId === incident.id ? "border-cyan-500 bg-slate-800" : "border-slate-800 bg-slate-950"}`}>
                  <p className="font-bold">#{incident.id} {incident.title}</p>
                  <p className="text-sm text-slate-400">{incident.service_name} · {incident.severity} · {incident.status}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="lg:col-span-2 space-y-5">
            {!activeIncident && <Panel title="Select or create an incident"><p className="text-slate-400">Create a scenario incident to start the agentic RCA workflow.</p></Panel>}
            {activeIncident && detail && (
              <>
                <Panel title="Selected Incident">
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><b>Title:</b> {activeIncident.title}</p>
                    <p><b>Service:</b> {activeIncident.service_name}</p>
                    <p><b>Severity:</b> <Status value={activeIncident.severity} /></p>
                    <p><b>Status:</b> <Status value={activeIncident.status} /></p>
                    <p className="md:col-span-2"><b>Description:</b> {activeIncident.description}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button onClick={analyzeIncident} disabled={loading}>Run / Re-run RCA</Button>
                    <Button onClick={() => approveRunbook("restart_service")} disabled={activeIncident.status === "resolved" || loading}>Approve Restart</Button>
                    <Button onClick={generatePostmortem} disabled={loading}>Generate Postmortem</Button>
                  </div>
                </Panel>

                <div className="flex flex-wrap gap-2">
                  {["overview", "evidence", "agents", "timeline", "postmortem", "evals"].map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-xl px-4 py-2 font-bold ${tab === item ? "bg-cyan-500 text-slate-950" : "bg-slate-900 border border-slate-800"}`}>{item}</button>)}
                </div>

                {tab === "overview" && <Overview detail={detail} />}
                {tab === "evidence" && <EvidenceView detail={detail} />}
                {tab === "agents" && <AgentsView detail={detail} />}
                {tab === "timeline" && <TimelineView detail={detail} />}
                {tab === "postmortem" && <PostmortemView detail={detail} />}
                {tab === "evals" && <EvalsView evals={evals} />}
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function Overview({ detail }: { detail: Detail }) {
  return <div className="space-y-5">
    <Panel title="AI Root-Cause Analysis">
      {!detail.rca && <p className="text-slate-400">RCA not generated yet.</p>}
      {detail.rca && <>
        <p className="text-2xl font-black text-cyan-300">{Math.round(detail.rca.confidence_score * 100)}% confidence</p>
        <p className="mt-3 leading-7 text-slate-200">{detail.rca.suspected_root_cause}</p>
      </>}
    </Panel>
    {detail.rca && <Panel title="Action Plan">
      <h3 className="font-bold text-emerald-300">Safe actions</h3>
      <ul className="mt-2 list-disc pl-5 space-y-1">{detail.rca.recommended_actions.map((a: string) => <li key={a}>{a}</li>)}</ul>
      <h3 className="mt-4 font-bold text-red-300">Risky actions requiring human approval</h3>
      <ul className="mt-2 list-disc pl-5 space-y-1">{detail.rca.risky_actions.map((a: string) => <li key={a}>{a}</li>)}</ul>
    </Panel>}
  </div>;
}

function EvidenceView({ detail }: { detail: Detail }) {
  return <Panel title="Evidence Collected by Agents">
    <div className="grid gap-3">
      {detail.evidence.length === 0 && <p className="text-slate-400">No evidence yet. Run RCA first.</p>}
      {detail.evidence.map((item) => <div key={item.source} className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><p className="font-bold text-cyan-300">{item.source}</p><p className="mt-1 text-slate-300">{item.summary}</p><pre className="mt-3 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-300">{JSON.stringify(item.details, null, 2)}</pre></div>)}
    </div>
  </Panel>;
}

function AgentsView({ detail }: { detail: Detail }) {
  return <Panel title="Agent Traces">
    <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="p-2">Agent</th><th className="p-2">Status</th><th className="p-2">Latency</th><th className="p-2">Output</th></tr></thead><tbody>{detail.agent_traces.map((t, i) => <tr key={i} className="border-t border-slate-800"><td className="p-2 font-bold text-cyan-300">{t.agent_name}</td><td className="p-2">{t.status}</td><td className="p-2">{t.latency_ms} ms</td><td className="p-2 text-slate-300">{t.output_summary}</td></tr>)}</tbody></table></div>
  </Panel>;
}

function TimelineView({ detail }: { detail: Detail }) {
  return <Panel title="Incident Timeline & Runbooks">
    <div className="space-y-3">{detail.timeline.map((t, i) => <div key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><p className="font-bold">{t.event_type} · <span className="text-cyan-300">{t.actor}</span></p><p className="text-slate-300">{t.message}</p><p className="text-xs text-slate-500">{t.created_at}</p></div>)}</div>
    <h3 className="mt-5 text-xl font-bold">Runbook executions</h3>
    <div className="mt-3 space-y-3">{detail.runbooks.length === 0 && <p className="text-slate-400">No runbooks executed yet.</p>}{detail.runbooks.map((r, i) => <div key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><p className="font-bold text-red-300">{r.runbook_name} · {r.status}</p><p className="text-xs text-slate-500">approved by {r.approved_by} · {r.created_at}</p></div>)}</div>
  </Panel>;
}

function PostmortemView({ detail }: { detail: Detail }) {
  return <Panel title="AI-Generated Postmortem">
    {!detail.postmortem && <p className="text-slate-400">No postmortem yet. Click Generate Postmortem.</p>}
    {detail.postmortem && <pre className="whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">{detail.postmortem}</pre>}
  </Panel>;
}

function EvalsView({ evals }: { evals: any[] }) {
  return <Panel title="RCA Evaluation Runs">
    {evals.length === 0 && <p className="text-slate-400">No eval runs yet. Click Run Eval Benchmark.</p>}
    <div className="space-y-3">{evals.map((e, i) => <div key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="font-bold text-cyan-300">{e.name}: {Math.round(e.score * 100)}%</p><p className="text-sm text-slate-400">{e.passed_cases}/{e.total_cases} cases passed · {e.created_at}</p></div>)}</div>
  </Panel>;
}

function Button({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="rounded-2xl bg-cyan-500 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">{children}</button>;
}

function Metric({ label, value }: { label: string; value: any }) {
  return <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6"><h2 className="mb-4 text-2xl font-bold">{title}</h2>{children}</div>;
}

function Status({ value }: { value: string }) {
  const color = value === "resolved" ? "text-emerald-300" : value === "critical" || value === "high" ? "text-red-300" : "text-yellow-300";
  return <span className={color}>{value}</span>;
}
