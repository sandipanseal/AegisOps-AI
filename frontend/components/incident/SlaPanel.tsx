"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, ShieldCheck, ShieldAlert } from "lucide-react";
import { api, type IncidentSla, type SlaStage } from "@/lib/api";
import { slaTone, duration, formatTime, toneClasses, type Tone } from "@/lib/format";
import { Card, SectionTitle, Badge, EmptyState, Loader } from "@/components/ui";

// Map an SLA tone to the bar fill color (emerald=good, amber=warn, rose=bad).
const BAR_FILL: Record<Tone, string> = {
  resolved: "bg-emerald-400",
  medium: "bg-amber-400",
  critical: "bg-rose-400",
  high: "bg-orange-400",
  low: "bg-sky-400",
  neutral: "bg-slate-400",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function StageRow({
  label,
  stage,
  delay,
}: {
  label: string;
  stage: SlaStage;
  delay: number;
}) {
  const tone = slaTone(stage.status);
  const budgetSeconds = stage.budget_minutes * 60;
  const fill = clamp01(budgetSeconds > 0 ? stage.elapsed_seconds / budgetSeconds : 0);

  let detail: string;
  if (stage.completed_at) {
    detail = `Completed at ${formatTime(stage.completed_at)}`;
  } else if (stage.remaining_seconds != null && stage.remaining_seconds < 0) {
    detail = `Overdue by ${duration(stage.remaining_seconds)}`;
  } else if (stage.remaining_seconds != null) {
    detail = `${duration(stage.remaining_seconds)} remaining`;
  } else {
    detail = "—";
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="text-[11px] font-medium text-slate-500">
            {stage.budget_minutes}m budget
          </span>
        </div>
        <Badge tone={tone}>{stage.status.replace(/_/g, " ")}</Badge>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fill * 100}%` }}
          transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
          className={`h-full rounded-full ${BAR_FILL[tone]}`}
        />
      </div>

      <p
        className={`mt-2 text-xs ${
          stage.breached ? "text-rose-300" : "text-slate-400"
        }`}
      >
        {detail}
      </p>
    </div>
  );
}

export function SlaPanel({ incidentId }: { incidentId: number }) {
  const [sla, setSla] = useState<IncidentSla | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await api<IncidentSla>(`/incidents/${incidentId}/sla`);
      setSla(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load SLA";
      if (/404|not found/i.test(message)) {
        setNotFound(true);
        setSla(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <SectionTitle eyebrow="SLA" title="Service-level objectives">
        {sla && (
          <Badge tone={sla.within_sla ? "resolved" : "critical"}>
            {sla.within_sla ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Within SLA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Breached
              </span>
            )}
          </Badge>
        )}
      </SectionTitle>

      {loading ? (
        <Loader label="Loading SLA" />
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : notFound || !sla ? (
        <EmptyState>No SLA policy tracked for this incident yet.</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-cyan-300/70" />
              Policy: ack {sla.policy.ack_minutes}m / resolve{" "}
              {sla.policy.resolve_minutes}m
            </span>
            <span className="capitalize">Severity: {sla.severity}</span>
          </div>

          <StageRow label="Acknowledge" stage={sla.acknowledge} delay={0.05} />
          <StageRow label="Resolve" stage={sla.resolve} delay={0.12} />
        </div>
      )}
    </Card>
  );
}

export default SlaPanel;
