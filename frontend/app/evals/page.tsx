"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { api, type EvalRun } from "@/lib/api";
import { pct, timeAgo } from "@/lib/format";
import { Button, Card, EmptyState, JsonBlock } from "@/components/ui";
import { EvalDatasetManager } from "@/components/EvalDatasetManager";

export default function EvalsPage() {
  const [evals, setEvals] = useState<EvalRun[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setEvals(await api<EvalRun[]>("/evals"));
  }

  async function runBenchmark() {
    setBusy(true);
    setMessage("Running benchmark…");
    try {
      const data = await api<{ passed_cases: number; total_cases: number }>(
        "/evals/run-benchmark",
        { method: "POST" }
      );
      setMessage(`Benchmark complete: ${data.passed_cases}/${data.total_cases} passed.`);
      await load();
    } catch (err: any) {
      setMessage(err.message);
    }
    setBusy(false);
  }

  useEffect(() => {
    load().catch(() => setMessage("Backend unreachable."));
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 pb-20 pt-8 md:px-8">
      <Card delay={0}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Evaluation
        </p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">RCA evaluation center</h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          AegisOps is eval-driven: every RCA is scored against a benchmark of known
          incidents so analysis quality is measured, tracked, and held accountable over
          time.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={runBenchmark} disabled={busy}>
            <span className="inline-flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Run benchmark</span>
          </Button>
          {message && <span className="text-sm text-emerald-300">{message}</span>}
        </div>
      </Card>

      <EvalDatasetManager onChanged={load} />

      <div className="grid gap-4">
        {evals.length === 0 && (
          <Card delay={0.06}>
            <EmptyState>No eval runs yet — run the benchmark above.</EmptyState>
          </Card>
        )}
        {evals.map((item, index) => (
          <Card key={index} delay={Math.min(index * 0.03, 0.2)}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{item.name}</h2>
              <span className="text-2xl font-black text-cyan-300">{pct(item.score)}</span>
            </div>
            <p className="text-sm text-slate-400">
              {item.passed_cases}/{item.total_cases} passed · {timeAgo(item.created_at)}
            </p>
            <JsonBlock data={item.details} />
          </Card>
        ))}
      </div>
    </main>
  );
}
