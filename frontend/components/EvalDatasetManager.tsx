"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { api, json, SERVICES, type EvalCase } from "@/lib/api";
import { severityTone, timeAgo } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Loader,
  SectionTitle,
} from "@/components/ui";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const SOURCE_CHIP: Record<string, string> = {
  builtin: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  custom: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  human_feedback: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

function sourceChip(source?: string): string {
  return (
    SOURCE_CHIP[(source || "").toLowerCase()] ||
    "bg-amber-500/15 text-amber-300 border-amber-500/30"
  );
}

function truncate(text: string, max = 140): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function EvalDatasetManager({ onChanged }: { onChanged?: () => void }) {
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Add-case form state.
  const [title, setTitle] = useState("");
  const [serviceName, setServiceName] = useState<string>(SERVICES[0]);
  const [severity, setSeverity] = useState<string>("medium");
  const [expectedRootCause, setExpectedRootCause] = useState("");
  const [logs, setLogs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<EvalCase[]>("/evals/dataset?include_inactive=true");
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const handleAdd = useCallback(async () => {
    if (!title.trim() || !expectedRootCause.trim()) {
      setFormError("Title and expected root cause are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const logLines = logs
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      await api(
        "/evals/dataset",
        json({
          title: title.trim(),
          service_name: serviceName,
          severity,
          description: undefined,
          expected_root_cause: expectedRootCause.trim(),
          logs: logLines.length ? logLines : undefined,
          source: "custom",
        })
      );
      setTitle("");
      setExpectedRootCause("");
      setLogs("");
      setSeverity("medium");
      setServiceName(SERVICES[0]);
      await afterMutation();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add case");
    } finally {
      setSubmitting(false);
    }
  }, [title, serviceName, severity, expectedRootCause, logs, afterMutation]);

  const handleSeed = useCallback(async () => {
    setBusy("seed");
    setError(null);
    try {
      await api("/evals/dataset/seed", { method: "POST" });
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed dataset");
    } finally {
      setBusy(null);
    }
  }, [afterMutation]);

  const handleToggle = useCallback(
    async (item: EvalCase) => {
      setBusy(`toggle-${item.id}`);
      setError(null);
      try {
        await api(`/evals/dataset/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !item.active }),
        });
        await afterMutation();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update case");
      } finally {
        setBusy(null);
      }
    },
    [afterMutation]
  );

  const handleDelete = useCallback(
    async (item: EvalCase) => {
      setBusy(`delete-${item.id}`);
      setError(null);
      try {
        await api(`/evals/dataset/${item.id}`, { method: "DELETE" });
        await afterMutation();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete case");
      } finally {
        setBusy(null);
      }
    },
    [afterMutation]
  );

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/40";

  return (
    <Card>
      <SectionTitle eyebrow="Dataset" title="RCA eval dataset">
        <Button
          variant="ghost"
          onClick={handleSeed}
          disabled={busy === "seed"}
          className="inline-flex items-center gap-2"
        >
          {busy === "seed" ? (
            <Loader label="Seeding" />
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Seed builtin
            </>
          )}
        </Button>
      </SectionTitle>

      {/* Add-case form */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Plus className="h-4 w-4 text-cyan-300" /> Add eval case
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Title
            </label>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Payment latency spike during checkout"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Service
            </label>
            <select
              className={inputClass}
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
            >
              {SERVICES.map((svc) => (
                <option key={svc} value={svc} className="bg-ink-950 text-slate-200">
                  {svc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Severity
            </label>
            <select
              className={inputClass}
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              {SEVERITIES.map((sev) => (
                <option key={sev} value={sev} className="bg-ink-950 text-slate-200">
                  {sev}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Expected root cause
            </label>
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={expectedRootCause}
              onChange={(e) => setExpectedRootCause(e.target.value)}
              placeholder="Database connection pool exhaustion under load"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Logs (one per line, optional)
            </label>
            <textarea
              className={`${inputClass} min-h-[72px] resize-y font-mono text-xs`}
              value={logs}
              onChange={(e) => setLogs(e.target.value)}
              placeholder={"ERROR pool timeout after 30s\nWARN slow query detected"}
            />
          </div>
        </div>

        {formError && (
          <p className="mt-3 text-xs font-medium text-rose-300">{formError}</p>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleAdd}
            disabled={submitting}
            className="inline-flex items-center gap-2"
          >
            {submitting ? (
              <Loader label="Adding" />
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add case
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300">
          {error}
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader label="Loading dataset" />
        </div>
      ) : cases.length === 0 ? (
        <EmptyState>
          No eval cases yet. Add one above or seed the builtin set.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {cases.map((item) => {
            const togglingThis = busy === `toggle-${item.id}`;
            const deletingThis = busy === `delete-${item.id}`;
            return (
              <li
                key={item.id}
                className={`rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-opacity ${
                  item.active ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Database className="h-4 w-4 shrink-0 text-cyan-300" />
                      <span className="font-semibold text-white">
                        {item.title}
                      </span>
                      <code className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                        {item.key}
                      </code>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={severityTone(item.severity)}>
                        {item.service_name}
                      </Badge>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${sourceChip(
                          item.source
                        )}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {item.source.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {timeAgo(item.created_at ?? undefined)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      {truncate(item.expected_root_cause)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.active}
                      aria-label={item.active ? "Deactivate case" : "Activate case"}
                      onClick={() => handleToggle(item)}
                      disabled={togglingThis}
                      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        item.active
                          ? "border-emerald-400/40 bg-emerald-500/30"
                          : "border-white/10 bg-white/[0.06]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          item.active ? "translate-x-[22px]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <Button
                      variant="danger"
                      onClick={() => handleDelete(item)}
                      disabled={deletingThis}
                      className="inline-flex items-center gap-1.5 px-3 py-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          variant="ghost"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>
    </Card>
  );
}

export default EvalDatasetManager;
