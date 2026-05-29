"use client";

import { use, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Detail = any;

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch(`${backendUrl}/incidents/${id}`);
    setDetail(await response.json());
  }

  async function generatePostmortem() {
    const response = await fetch(`${backendUrl}/incidents/${id}/postmortem`, { method: "POST" });
    const data = await response.json();
    setMessage(response.ok ? "Postmortem generated." : data.detail);
    await load();
  }

  useEffect(() => {
    load();
  }, [id]);

  if (!detail?.incident) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-100">Loading...</main>;
  }

  const incident = detail.incident;

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex gap-4 text-cyan-300">
          <a href="/">← Dashboard</a>
          <a href="/incidents">Incident Center</a>
          <a href={`/postmortems/${incident.id}`}>Postmortem page</a>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Incident Detail</p>
          <h1 className="mt-3 text-4xl font-black">#{incident.id} {incident.title}</h1>
          <p className="mt-2 text-slate-300">{incident.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Service" value={incident.service_name} />
            <Metric label="Severity" value={incident.severity} />
            <Metric label="Status" value={incident.status} />
            <Metric label="Scenario" value={incident.scenario_key} />
          </div>
          <button onClick={generatePostmortem} className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">Generate Postmortem</button>
          {message && <p className="mt-3 text-emerald-300">{message}</p>}
        </section>

        <Card title="Root-Cause Analysis">
          {detail.rca ? (
            <>
              <p className="text-2xl font-black text-cyan-300">{Math.round(detail.rca.confidence_score * 100)}% confidence</p>
              <p className="mt-3 leading-7 text-slate-200">{detail.rca.suspected_root_cause}</p>
            </>
          ) : <p className="text-slate-400">No RCA generated yet.</p>}
        </Card>

        <Card title="Evidence Records">
          <div className="grid gap-3">
            {detail.evidence.map((item: any, index: number) => (
              <div key={index} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="font-bold text-cyan-300">{item.source}</p>
                <p className="mt-1 text-slate-200">{item.summary}</p>
                <pre className="mt-3 overflow-auto rounded-lg bg-black p-3 text-xs text-slate-300">{JSON.stringify(item.details, null, 2)}</pre>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Agent Traces">
          <div className="grid gap-3">
            {detail.agent_traces.map((item: any, index: number) => (
              <div key={index} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <div className="flex justify-between gap-4"><b>{item.agent_name}</b><span>{Math.round(item.latency_ms)} ms</span></div>
                <p className="mt-2 text-slate-300">{item.output_summary}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Timeline">
          <ol className="space-y-3">
            {detail.timeline.map((item: any, index: number) => (
              <li key={index} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <b>{item.event_type}</b> <span className="text-slate-400">by {item.actor}</span>
                <p>{item.message}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 text-2xl font-black">{title}</h2>{children}</section>;
}
