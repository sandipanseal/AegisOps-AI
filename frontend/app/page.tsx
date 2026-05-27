"use client";

import { useEffect, useState } from "react";

type Incident = {
  id: number;
  title: string;
  description: string;
  service_name: string;
  severity: string;
  status: string;
};

type RCAResult = {
  incident_id: number;
  suspected_root_cause: string;
  confidence_score: number;
  recommended_actions: string[];
  risky_actions: string[];
  requires_human_approval: boolean;
  evidence: { source: string; summary: string; details: Record<string, unknown> }[];
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [rca, setRca] = useState<RCAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function loadIncidents() {
    const response = await fetch(`${backendUrl}/incidents`);
    const data = await response.json();
    setIncidents(data);
  }

  useEffect(() => {
    loadIncidents().catch(() => setMessage("Backend is not reachable yet."));
  }, []);

  async function createDemoIncident() {
    setLoading(true);
    setMessage("");
    const response = await fetch(`${backendUrl}/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Payment API latency spike",
        description: "Payment service latency increased by 400% after latest deployment.",
        service_name: "payment-service",
        severity: "critical",
      }),
    });
    const data = await response.json();
    setActiveIncident(data);
    setRca(null);
    await loadIncidents();
    setLoading(false);
  }

  async function analyzeIncident() {
    if (!activeIncident) return;
    setLoading(true);
    setMessage("");
    const response = await fetch(`${backendUrl}/incidents/${activeIncident.id}/analyze`, { method: "POST" });
    const data = await response.json();
    setRca(data);
    await loadIncidents();
    setLoading(false);
  }

  async function approveRunbook(runbookName: string) {
    if (!activeIncident) return;
    setLoading(true);
    const response = await fetch(`${backendUrl}/runbooks/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_id: activeIncident.id,
        runbook_name: runbookName,
        approved_by: "portfolio-reviewer",
        approved: true,
      }),
    });
    const data = await response.json();
    setMessage(`Runbook result: ${data.status}. MVP mode did not modify real infrastructure.`);
    await loadIncidents();
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <p className="text-sm font-semibold tracking-widest text-cyan-300">AGENTIC AI INCIDENT COMMANDER</p>
          <h1 className="mt-3 text-4xl md:text-6xl font-black">AegisOps AI</h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Multi-agent GenAI platform for incident triage, root-cause analysis, deployment-aware debugging,
            approval-gated runbooks, and SRE observability.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={createDemoIncident} className="rounded-2xl bg-cyan-500 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-400">
              Create Demo Incident
            </button>
            <button onClick={analyzeIncident} disabled={!activeIncident || loading} className="rounded-2xl bg-purple-600 px-5 py-3 font-bold hover:bg-purple-500 disabled:opacity-40">
              Run AI RCA
            </button>
            <a href="http://localhost:8000/docs" target="_blank" className="rounded-2xl border border-slate-700 px-5 py-3 font-bold hover:bg-slate-800">
              Backend Docs
            </a>
            <a href="http://localhost:3001" target="_blank" className="rounded-2xl border border-slate-700 px-5 py-3 font-bold hover:bg-slate-800">
              Grafana
            </a>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-emerald-800 bg-emerald-950/60 p-4 text-emerald-200">{message}</div>}
        {loading && <div className="rounded-2xl border border-yellow-700 bg-yellow-950/60 p-4 text-yellow-200">Processing...</div>}

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Metric label="Incidents" value={incidents.length.toString()} />
          <Metric label="Active Severity" value={activeIncident?.severity || "--"} />
          <Metric label="AI Confidence" value={rca ? `${Math.round(rca.confidence_score * 100)}%` : "--"} />
          <Metric label="Approval Needed" value={rca?.requires_human_approval ? "Yes" : "--"} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-bold">Incident Queue</h2>
            <div className="mt-4 space-y-3">
              {incidents.length === 0 && <p className="text-slate-400">No incidents yet. Create a demo incident.</p>}
              {incidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => { setActiveIncident(incident); setRca(null); }}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left hover:border-cyan-500"
                >
                  <p className="font-bold">#{incident.id} {incident.title}</p>
                  <p className="text-sm text-slate-400">{incident.service_name} · {incident.severity} · {incident.status}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {activeIncident && (
              <Panel title="Selected Incident">
                <p><b>Title:</b> {activeIncident.title}</p>
                <p><b>Description:</b> {activeIncident.description}</p>
                <p><b>Service:</b> {activeIncident.service_name}</p>
                <p><b>Status:</b> {activeIncident.status}</p>
              </Panel>
            )}

            {rca && (
              <>
                <Panel title="AI Root-Cause Analysis">
                  <p className="leading-7 text-slate-200">{rca.suspected_root_cause}</p>
                </Panel>

                <Panel title="Evidence Collected by Agents">
                  <div className="grid gap-3">
                    {rca.evidence.map((item) => (
                      <div key={item.source} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                        <p className="font-bold text-cyan-300">{item.source}</p>
                        <p className="text-slate-300">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Recommended Safe Actions">
                  <ul className="list-disc pl-5 space-y-2">
                    {rca.recommended_actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                </Panel>

                <Panel title="Risky Actions: Human Approval Required">
                  <ul className="list-disc pl-5 space-y-2 text-red-200">
                    {rca.risky_actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                  <button onClick={() => approveRunbook("restart_service")} className="mt-5 rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500">
                    Approve Restart Runbook
                  </button>
                </Panel>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>
      {children}
    </div>
  );
}
