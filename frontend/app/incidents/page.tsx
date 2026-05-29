"use client";

import { useEffect, useState } from "react";

type Incident = {
  id: number;
  title: string;
  service_name: string;
  severity: string;
  status: string;
  created_at?: string;
};

export default function IncidentsPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [message, setMessage] = useState("");

  async function loadIncidents() {
    const response = await fetch(`${backendUrl}/incidents`);
    setIncidents(await response.json());
  }

  async function simulate(service: string) {
    setMessage(`Injecting synthetic failure into ${service}...`);
    const response = await fetch(`${backendUrl}/demo-services/${service}/simulate-failure`, { method: "POST" });
    const data = await response.json();
    setMessage(response.ok ? `Injected ${data.mode} into ${service}.` : `Failed: ${data.detail}`);
  }

  useEffect(() => {
    loadIncidents();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <a href="/" className="text-cyan-300">← Back to dashboard</a>
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">AegisOps AI</p>
          <h1 className="mt-3 text-4xl font-black">Incident Center</h1>
          <p className="mt-2 max-w-3xl text-slate-300">
            Dedicated incident list for reviewing RCA status, generated postmortems, timelines, and runbook history.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">Demo Microservice Failure Injection</h2>
          <p className="mt-2 text-sm text-slate-400">Inject real synthetic signals into demo services, then create/run matching scenarios from the main dashboard.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {["payment-service", "checkout-service", "auth-service", "recommendation-service"].map((service) => (
              <button key={service} onClick={() => simulate(service)} className="rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-300">
                Inject {service}
              </button>
            ))}
          </div>
          {message && <div className="mt-4 rounded-xl border border-emerald-800 bg-emerald-950 p-3 text-emerald-200">{message}</div>}
        </section>

        <section className="grid gap-4">
          {incidents.map((item) => (
            <a key={item.id} href={`/incidents/${item.id}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-cyan-400">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">#{item.id} {item.title}</h2>
                  <p className="text-sm text-slate-400">{item.service_name} · {item.severity}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${item.status === "resolved" ? "bg-emerald-900 text-emerald-200" : "bg-amber-900 text-amber-200"}`}>
                  {item.status}
                </span>
              </div>
            </a>
          ))}
          {incidents.length === 0 && <p className="text-slate-400">No incidents yet. Create scenarios from the main dashboard.</p>}
        </section>
      </div>
    </main>
  );
}
