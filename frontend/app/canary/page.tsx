"use client";

import { useEffect, useState } from "react";
import { Rocket, GitCompareArrows, ArrowRight } from "lucide-react";
import {
  api,
  json,
  SERVICES,
  CanaryAnalysis,
  type CanaryMetricsT,
} from "@/lib/api";
import { timeAgo, verdictTone, slaTone } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Loader,
  Metric,
  SectionTitle,
} from "@/components/ui";

type MetricRow = {
  key: keyof CanaryMetricsT;
  label: string;
  format: (value: number) => string;
};

const METRIC_ROWS: MetricRow[] = [
  { key: "p95_latency_ms", label: "p95 latency", format: (v) => `${Math.round(v)} ms` },
  { key: "error_rate_pct", label: "Error rate", format: (v) => `${v.toFixed(2)}%` },
  { key: "cpu_pct", label: "CPU", format: (v) => `${Math.round(v)}%` },
  { key: "memory_pct", label: "Memory", format: (v) => `${Math.round(v)}%` },
];

const VERDICT_LABEL: Record<CanaryAnalysis["verdict"], string> = {
  promote: "Promote",
  hold: "Hold",
  rollback: "Rollback",
};

export default function CanaryPage() {
  const [service, setService] = useState<string>(SERVICES[0]);
  const [result, setResult] = useState<CanaryAnalysis | null>(null);
  const [analyses, setAnalyses] = useState<CanaryAnalysis[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [listError, setListError] = useState("");

  async function loadAnalyses() {
    try {
      setAnalyses(await api<CanaryAnalysis[]>("/canary/analyses"));
      setListError("");
    } catch (err: any) {
      setListError(err?.message || "Failed to load analyses.");
    }
  }

  async function analyze() {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<CanaryAnalysis>(
        "/canary/analyze",
        json({ service_name: service })
      );
      setResult(data);
      await loadAnalyses();
    } catch (err: any) {
      setMessage(err?.message || "Canary analysis failed.");
    }
    setBusy(false);
  }

  useEffect(() => {
    loadAnalyses();
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 pb-20 pt-8 md:px-8">
      <Card delay={0}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Progressive delivery
        </p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
          Canary deployment analysis
        </h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Compare a canary release against its baseline across latency, errors, and
          resource pressure. AegisOps scores the rollout and returns a promote, hold, or
          rollback verdict with the signals behind the call.
        </p>
      </Card>

      <Card delay={0.06}>
        <SectionTitle
          eyebrow="Control"
          title="Run an analysis"
        >
          <Rocket className="h-5 w-5 text-cyan-300" />
        </SectionTitle>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            disabled={busy}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 outline-none transition-colors hover:border-cyan-400/40 focus:border-cyan-400/60 disabled:opacity-40"
          >
            {SERVICES.map((s) => (
              <option key={s} value={s} className="bg-ink-950 text-slate-200">
                {s}
              </option>
            ))}
          </select>
          <Button onClick={analyze} disabled={busy}>
            <span className="inline-flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4" /> Analyze canary
            </span>
          </Button>
          {busy && <Loader label="Analyzing" />}
          {message && !busy && <span className="text-sm text-rose-300">{message}</span>}
        </div>
      </Card>

      {result && (
        <Card delay={0.1}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge tone={verdictTone(result.verdict)}>
                {VERDICT_LABEL[result.verdict]}
              </Badge>
              <h2 className="text-lg font-bold text-white">{result.service_name}</h2>
            </div>
            <span className="text-xs text-slate-500">{timeAgo(result.created_at ?? undefined)}</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Canary score"
              value={`${Math.round(result.score)} / 100`}
              accent
              hint="Higher is healthier"
            />
            <Metric label="Verdict" value={VERDICT_LABEL[result.verdict]} />
            <Metric label="Signals" value={result.reasons.length} hint="Evaluated checks" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Baseline
              </p>
              <dl className="mt-3 space-y-2">
                {METRIC_ROWS.map((row) => (
                  <div key={row.key} className="flex items-center justify-between text-sm">
                    <dt className="text-slate-400">{row.label}</dt>
                    <dd className="font-semibold text-slate-200">
                      {row.format(result.baseline[row.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Canary
              </p>
              <dl className="mt-3 space-y-2">
                {METRIC_ROWS.map((row) => (
                  <div key={row.key} className="flex items-center justify-between text-sm">
                    <dt className="text-slate-400">{row.label}</dt>
                    <dd className="font-semibold text-white">
                      {row.format(result.canary[row.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Reasons
            </p>
            {result.reasons.length === 0 ? (
              <div className="mt-3">
                <EmptyState>No signals reported for this analysis.</EmptyState>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {result.reasons.map((reason, index) => (
                  <li
                    key={`${reason.signal}-${index}`}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <span className="min-w-[8rem] text-sm font-semibold text-slate-200">
                      {reason.signal}
                    </span>
                    <Badge tone={slaTone(reason.verdict)}>{reason.verdict}</Badge>
                    <span className="flex-1 text-sm text-slate-400">{reason.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      <Card delay={0.14}>
        <SectionTitle eyebrow="History" title="Recent analyses">
          <ArrowRight className="h-5 w-5 text-cyan-300" />
        </SectionTitle>
        {listError ? (
          <EmptyState>{listError}</EmptyState>
        ) : analyses.length === 0 ? (
          <EmptyState>No canary analyses yet — run one above.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {analyses.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Badge tone={verdictTone(item.verdict)}>
                    {VERDICT_LABEL[item.verdict]}
                  </Badge>
                  <span className="text-sm font-semibold text-slate-200">
                    {item.service_name}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-black text-cyan-300">
                    {Math.round(item.score)}
                  </span>
                  <span className="text-slate-500">{timeAgo(item.created_at ?? undefined)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
