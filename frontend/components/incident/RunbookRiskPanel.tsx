"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, ShieldCheck, ShieldAlert } from "lucide-react";
import { api, type RunbookRisk } from "@/lib/api";
import { riskTone } from "@/lib/format";
import { Badge, Card, EmptyState, Loader, SectionTitle } from "@/components/ui";

function barColor(score: number): string {
  if (score >= 60) return "bg-rose-400";
  if (score >= 30) return "bg-amber-400";
  return "bg-emerald-400";
}

function RunbookRow({ rb, index }: { rb: RunbookRisk; index: number }) {
  const [open, setOpen] = useState(false);
  const score = Math.max(0, Math.min(100, Math.round(rb.risk_score)));
  const hasFactors = rb.factors && rb.factors.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-white">
              {rb.runbook}
            </span>
            <Badge tone={riskTone(rb.risk_band)}>{rb.risk_band} risk</Badge>
            {rb.requires_approval ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5" />
                Approval required
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Auto-runnable
              </span>
            )}
          </div>
          {rb.description && (
            <p className="mt-1 text-xs text-slate-400">{rb.description}</p>
          )}
          {typeof rb.recovery_minutes === "number" && (
            <p className="mt-1 text-[11px] text-slate-500">
              Est. recovery ~{rb.recovery_minutes} min
            </p>
          )}
        </div>

        <div className="w-full sm:w-44">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-2xl font-black tracking-tight text-white">
              {score}
            </span>
            <span className="text-xs font-medium text-slate-500">/ 100</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-white/5 bg-white/[0.04]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
              className={`h-full rounded-full ${barColor(score)}`}
            />
          </div>
        </div>
      </div>

      {hasFactors && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-300/80 transition-colors hover:text-cyan-200"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {rb.factors.length} risk factor{rb.factors.length === 1 ? "" : "s"}
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5">
              {rb.factors.map((f, i) => (
                <li
                  key={`${f.label}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs"
                >
                  <span className="text-slate-300">
                    <span className="font-medium text-slate-200">{f.label}:</span>{" "}
                    {f.value}
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      f.points >= 0 ? "text-rose-300" : "text-emerald-300"
                    }`}
                  >
                    {f.points >= 0 ? "+" : ""}
                    {f.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function RunbookRiskPanel() {
  const [runbooks, setRunbooks] = useState<RunbookRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<RunbookRisk[]>("/runbooks/risk");
        if (active) setRunbooks(data);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load runbook risk");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <SectionTitle eyebrow="Safety" title="Runbook risk scoring" />

      {loading ? (
        <div className="py-6">
          <Loader label="Scoring runbooks" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : runbooks.length === 0 ? (
        <EmptyState>No runbook risk profiles available yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {runbooks.map((rb, i) => (
            <RunbookRow key={rb.key ?? rb.runbook} rb={rb} index={i} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default RunbookRiskPanel;
