"use client";

import { use, useEffect, useState } from "react";

export default function PostmortemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [detail, setDetail] = useState<any | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch(`${backendUrl}/incidents/${id}`);
    setDetail(await response.json());
  }

  async function generate() {
    const response = await fetch(`${backendUrl}/incidents/${id}/postmortem`, { method: "POST" });
    const data = await response.json();
    setMessage(response.ok ? "Generated latest postmortem." : data.detail);
    await load();
  }

  useEffect(() => { load(); }, [id]);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex gap-4 text-cyan-300">
          <a href="/">← Dashboard</a>
          <a href={`/incidents/${id}`}>Incident detail</a>
        </div>
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Postmortem</p>
          <h1 className="mt-3 text-4xl font-black">Incident #{id}</h1>
          <button onClick={generate} className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">Generate / Refresh</button>
          {message && <p className="mt-3 text-emerald-300">{message}</p>}
        </section>
        <article className="whitespace-pre-wrap rounded-3xl border border-slate-800 bg-slate-900 p-8 leading-7 text-slate-200">
          {detail?.postmortem || "No postmortem exists yet."}
        </article>
      </div>
    </main>
  );
}
