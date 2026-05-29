"use client";

import { useEffect, useState } from "react";

export default function EvalsPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [evals, setEvals] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch(`${backendUrl}/evals`);
    setEvals(await response.json());
  }

  async function runBenchmark() {
    setMessage("Running benchmark...");
    const response = await fetch(`${backendUrl}/evals/run-benchmark`, { method: "POST" });
    const data = await response.json();
    setMessage(response.ok ? `Benchmark complete: ${data.passed_cases}/${data.total_cases} passed.` : data.detail);
    await load();
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <a href="/" className="text-cyan-300">← Back to dashboard</a>
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">AegisOps AI</p>
          <h1 className="mt-3 text-4xl font-black">RCA Evaluation Center</h1>
          <p className="mt-2 max-w-3xl text-slate-300">Track RCA benchmark runs and correctness scores. This makes the project eval-driven rather than just a demo.</p>
          <button onClick={runBenchmark} className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">Run Benchmark</button>
          {message && <p className="mt-3 text-emerald-300">{message}</p>}
        </section>
        <section className="grid gap-4">
          {evals.map((item, index) => (
            <div key={index} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex justify-between"><h2 className="text-xl font-bold">{item.name}</h2><b className="text-cyan-300">{Math.round(item.score * 100)}%</b></div>
              <p className="text-slate-300">{item.passed_cases}/{item.total_cases} passed · {item.created_at}</p>
              <pre className="mt-3 overflow-auto rounded-lg bg-black p-3 text-xs text-slate-300">{JSON.stringify(item.details, null, 2)}</pre>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
