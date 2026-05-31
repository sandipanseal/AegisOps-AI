"use client";

import { motion } from "framer-motion";
import { type ConfidenceExplanation } from "@/lib/api";
import { Card, SectionTitle, EmptyState } from "@/components/ui";

export function ConfidencePanel({
  explanation,
}: {
  explanation?: ConfidenceExplanation | null;
}) {
  if (!explanation) {
    return (
      <Card>
        <SectionTitle eyebrow="Explainability" title="Why this confidence" />
        <div className="mt-4">
          <EmptyState>Run RCA to see the confidence breakdown.</EmptyState>
        </div>
      </Card>
    );
  }

  const { score, summary, factors } = explanation;
  const maxAbs = factors.reduce(
    (max, f) => Math.max(max, Math.abs(f.delta)),
    0,
  );

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <SectionTitle eyebrow="Explainability" title="Why this confidence" />
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold tabular-nums text-cyan-300">
            {Math.round(score * 100)}%
          </div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            confidence
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-300">{summary}</p>

      {factors.length === 0 ? (
        <div className="mt-4">
          <EmptyState>No contributing factors were recorded.</EmptyState>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {factors.map((factor, i) => {
            const positive = factor.delta >= 0;
            const width =
              maxAbs > 0 ? (Math.abs(factor.delta) / maxAbs) * 100 : 0;
            const sign = positive ? "+" : "-";
            return (
              <li
                key={`${factor.label}-${i}`}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-200">
                    {factor.label}
                  </span>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      positive ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {sign}
                    {Math.abs(factor.delta).toFixed(2)}
                  </span>
                </div>

                {factor.detail ? (
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {factor.detail}
                  </p>
                ) : null}

                <div className="mt-2 grid grid-cols-2 items-center gap-0">
                  <div className="flex justify-end pr-px">
                    {positive ? null : (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-1.5 rounded-full bg-rose-400/80"
                      />
                    )}
                  </div>
                  <div className="flex justify-start pl-px">
                    {positive ? (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-1.5 rounded-full bg-emerald-400/80"
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
