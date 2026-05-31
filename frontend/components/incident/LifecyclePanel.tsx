"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CircleDot,
  History,
  UserCog,
} from "lucide-react";
import { api, json, type Lifecycle } from "@/lib/api";
import { lifecycleTone, timeAgo } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Loader,
  SectionTitle,
} from "@/components/ui";

const ACTOR = "sre-oncall";

export function LifecyclePanel({
  incidentId,
  onChanged,
}: {
  incidentId: number;
  onChanged?: () => void;
}) {
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Lifecycle>(`/incidents/${incidentId}/lifecycle`);
      setLifecycle(data);
      setAssignee(data.assignee || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lifecycle");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(toStatus: string) {
    setBusy(`transition:${toStatus}`);
    setError(null);
    try {
      await api(
        `/incidents/${incidentId}/transition`,
        json({ to_status: toStatus, actor: ACTOR })
      );
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setBusy(null);
    }
  }

  async function assign() {
    const value = assignee.trim();
    if (!value) return;
    setBusy("assign");
    setError(null);
    try {
      await api(
        `/incidents/${incidentId}/assign`,
        json({ assignee: value, actor: ACTOR })
      );
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(null);
    }
  }

  const currentIndex = lifecycle
    ? lifecycle.states.findIndex(
        (s) => s.toLowerCase() === lifecycle.status.toLowerCase()
      )
    : -1;

  return (
    <Card>
      <SectionTitle eyebrow="Workflow" title="Lifecycle">
        {lifecycle && (
          <Badge tone={lifecycleTone(lifecycle.status)}>{lifecycle.status}</Badge>
        )}
      </SectionTitle>

      {loading && <Loader label="Loading lifecycle" />}

      {!loading && error && !lifecycle && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {!loading && lifecycle && (
        <div className="space-y-6">
          {/* Stepper */}
          <div className="flex flex-wrap items-center gap-2">
            {lifecycle.states.map((state, i) => {
              const isCurrent = i === currentIndex;
              const isPassed = currentIndex >= 0 && i < currentIndex;
              return (
                <div key={state} className="flex items-center gap-2">
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-semibold capitalize ${
                      isCurrent
                        ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200 shadow-glow"
                        : isPassed
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/90"
                        : "border-white/10 bg-white/[0.02] text-slate-400"
                    }`}
                  >
                    {isPassed ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDot className="h-3.5 w-3.5" />
                    )}
                    {state}
                  </motion.div>
                  {i < lifecycle.states.length - 1 && (
                    <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Allowed transitions */}
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">
              Available transitions
            </p>
            {lifecycle.allowed_next.length === 0 ? (
              <p className="text-sm text-slate-500">No further transitions.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {lifecycle.allowed_next.map((next) => (
                  <Button
                    key={next}
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => transition(next)}
                    className="capitalize"
                  >
                    {busy === `transition:${next}` ? "Moving…" : next}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Assignee */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <UserCog className="h-3.5 w-3.5" />
              Assignee
              <span className="text-slate-500">
                {lifecycle.assignee ? `· ${lifecycle.assignee}` : "· unassigned"}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void assign();
                }}
                placeholder="assignee handle"
                className="min-w-[180px] flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/40"
              />
              <Button
                variant="ghost"
                disabled={busy !== null || !assignee.trim()}
                onClick={assign}
              >
                {busy === "assign" ? "Assigning…" : "Assign"}
              </Button>
            </div>
          </div>

          {/* Error (with lifecycle present) */}
          {error && (
            <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
              {error}
            </p>
          )}

          {/* History */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <History className="h-3.5 w-3.5" />
              History
            </p>
            {lifecycle.transitions.length === 0 ? (
              <EmptyState>No transitions recorded yet.</EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {lifecycle.transitions.map((t, i) => (
                  <li
                    key={`${t.from_status}-${t.to_status}-${t.created_at ?? i}`}
                    className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
                  >
                    <span className="capitalize text-slate-400">
                      {t.from_status}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                    <span className="font-semibold capitalize text-slate-200">
                      {t.to_status}
                    </span>
                    <span className="text-slate-500">by {t.actor}</span>
                    {t.note && (
                      <span className="text-slate-500">· {t.note}</span>
                    )}
                    <span className="ml-auto text-xs text-slate-500">
                      {timeAgo(t.created_at ?? undefined)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
