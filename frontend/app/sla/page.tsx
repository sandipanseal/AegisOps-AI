"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Timer } from "lucide-react";
import { api, type SlaOverview, type SlaStage } from "@/lib/api";
import {
  pct,
  duration,
  slaTone,
  severityTone,
  statusTone,
  type Tone,
} from "@/lib/format";
import { Badge, Card, EmptyState, Loader, Metric } from "@/components/ui";

const BAR_FILL: Record<Tone, string> = {
  critical: "bg-rose-400",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-sky-400",
  resolved: "bg-emerald-400",
  neutral: "bg-slate-400",
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function stageProgress(stage: SlaStage): number {
  const budgetSeconds = stage.budget_minutes * 60;
  if (budgetSeconds <= 0) return stage.breached ? 1 : 0;
  return clamp01(stage.elapsed_seconds / budgetSeconds);
}

function stageRemaining(stage: SlaStage): string {
  if (stage.completed_at) {
    return stage.breached ? "breached" : "met";
  }
  if (stage.breached) return "breached";
  if (stage.remaining_seconds == null) return "—";
  return `${duration(stage.remaining_seconds)} left`;
}

function StageBar({ label, stage }: { label: string; stage: SlaStage }) {
  const tone = slaTone(stage.status);
  const fill = clamp01(stageProgress(stage));
  const remaining = stageRemaining(stage);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="inline-flex items-center gap-2 text-slate-400">
          <span className="capitalize text-slate-300">
            {stage.status.replace("_", " ")}
          </span>
          <span className="text-slate-500">·</span>
          <span>{remaining}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full transition-all ${BAR_FILL[tone]}`}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {stage.budget_minutes}m budget
      </p>
    </div>
  );
}

export default function SlaPage() {
  const [overview, setOverview] = useState<SlaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api<SlaOverview>("/sla/overview");
      setOverview(data);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Backend unreachable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const policies = overview ? Object.entries(overview.policies) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 pb-20 pt-8 md:px-8">
      <Card delay={0}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Reliability
        </p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
          SLA tracking
        </h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Acknowledge and resolve every incident inside its severity budget.
          AegisOps tracks each stage in real time so breaches surface before they
          become postmortems.
        </p>
      </Card>

      {error && (
        <Card delay={0.04}>
          <p className="text-sm text-rose-300">{error}</p>
        </Card>
      )}

      {loading && !overview && (
        <Card delay={0.04}>
          <Loader label="Loading SLA overview" />
        </Card>
      )}

      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Compliance"
              value={pct(overview.compliance_ratio)}
              hint="Incidents within SLA"
              accent
              delay={0.02}
            />
            <Metric
              label="Within SLA"
              value={`${overview.within_sla}/${overview.total_incidents}`}
              hint="On-budget incidents"
              delay={0.05}
            />
            <Metric
              label="Ack breaches"
              value={overview.ack_breaches}
              hint="Missed acknowledge budget"
              delay={0.08}
            />
            <Metric
              label="Resolve breaches"
              value={overview.resolve_breaches}
              hint="Missed resolve budget"
              delay={0.11}
            />
          </div>

          <Card delay={0.06}>
            <div className="mb-4 flex items-center gap-2">
              <Timer className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-bold text-white">Severity policies</h2>
            </div>
            {policies.length === 0 ? (
              <EmptyState>No SLA policies configured.</EmptyState>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Severity</th>
                      <th className="px-4 py-3 font-semibold">Acknowledge</th>
                      <th className="px-4 py-3 font-semibold">Resolve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map(([severity, policy], index) => (
                      <tr
                        key={severity}
                        className={
                          index === 0 ? "" : "border-t border-white/[0.06]"
                        }
                      >
                        <td className="px-4 py-3">
                          <Badge tone={severityTone(severity)}>{severity}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {policy.ack_minutes} min
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {policy.resolve_minutes} min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card delay={0.09}>
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-bold text-white">Incident SLAs</h2>
            </div>
            {overview.incidents.length === 0 ? (
              <EmptyState>No incidents are being tracked yet.</EmptyState>
            ) : (
              <div className="space-y-3">
                {overview.incidents.map((incident, index) => (
                  <Link
                    key={incident.incident_id}
                    href={`/incidents/${incident.incident_id}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.04]"
                    style={{
                      animationDelay: `${Math.min(index * 0.03, 0.2)}s`,
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-white">
                          {incident.title}
                        </h3>
                        <p className="mt-0.5 font-mono text-xs text-cyan-300">
                          {incident.service_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={severityTone(incident.severity)}>
                          {incident.severity}
                        </Badge>
                        <Badge
                          tone={
                            incident.within_sla
                              ? slaTone("met")
                              : statusTone(incident.status)
                          }
                        >
                          {incident.within_sla ? "within SLA" : incident.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <StageBar
                        label="Acknowledge"
                        stage={incident.acknowledge}
                      />
                      <StageBar label="Resolve" stage={incident.resolve} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
