"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageSquare, Sparkles, Star } from "lucide-react";
import { api, json, type RcaFeedback } from "@/lib/api";
import { timeAgo, verdictTone } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Loader,
  SectionTitle,
} from "@/components/ui";

type Verdict = "accurate" | "partially_accurate" | "inaccurate";

const VERDICTS: { value: Verdict; label: string }[] = [
  { value: "accurate", label: "Accurate" },
  { value: "partially_accurate", label: "Partially accurate" },
  { value: "inaccurate", label: "Inaccurate" },
];

type SubmitResponse = {
  feedback: RcaFeedback;
  promoted_eval_case?: unknown | null;
};

export function RcaFeedbackPanel({
  incidentId,
  onSubmitted,
}: {
  incidentId: number;
  onSubmitted?: () => void;
}) {
  const [items, setItems] = useState<RcaFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [correctedRootCause, setCorrectedRootCause] = useState("");
  const [comment, setComment] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [promoteToEval, setPromoteToEval] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [promotedNote, setPromotedNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api<RcaFeedback[]>(
        `/incidents/${incidentId}/rca-feedback`
      );
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canSubmit = verdict !== null && reviewer.trim().length > 0 && !submitting;

  async function submit() {
    if (verdict === null || reviewer.trim().length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    setPromotedNote(false);
    try {
      const body = {
        verdict,
        rating: rating ?? undefined,
        corrected_root_cause: correctedRootCause.trim() || undefined,
        comment: comment.trim() || undefined,
        reviewer: reviewer.trim(),
        promote_to_eval: promoteToEval,
      };
      const res = await api<SubmitResponse>(
        `/incidents/${incidentId}/rca-feedback`,
        json(body)
      );
      if (res?.promoted_eval_case) setPromotedNote(true);
      setVerdict(null);
      setRating(null);
      setCorrectedRootCause("");
      setComment("");
      await load();
      onSubmitted?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <SectionTitle eyebrow="Human in the loop" title="Rate this RCA" />

      {/* Verdict selector */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {VERDICTS.map((v) => {
          const tone = verdictTone(v.value);
          const selected = verdict === v.value;
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => setVerdict(v.value)}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                selected
                  ? tone === "resolved"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                    : tone === "medium"
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                    : "border-rose-500/40 bg-rose-500/15 text-rose-200"
                  : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-cyan-400/40 hover:bg-white/[0.04]"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Rating selector */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-slate-400">Rating (optional)</p>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = rating != null && n <= rating;
            return (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(rating === n ? null : n)}
                className="rounded-lg p-1 transition-colors hover:bg-white/[0.04]"
              >
                <Star
                  className={`h-5 w-5 transition-colors ${
                    active ? "fill-amber-300 text-amber-300" : "text-slate-600"
                  }`}
                />
              </button>
            );
          })}
          {rating != null && (
            <span className="ml-2 text-xs text-slate-400">{rating}/5</span>
          )}
        </div>
      </div>

      {/* Corrected root cause */}
      <div className="mt-5">
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Corrected root cause (optional)
        </label>
        <textarea
          value={correctedRootCause}
          onChange={(e) => setCorrectedRootCause(e.target.value)}
          rows={3}
          placeholder="If the AI got it wrong, describe the actual root cause…"
          className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
        />
      </div>

      {/* Comment */}
      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Comment (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Additional notes for the team…"
          className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
        />
      </div>

      {/* Reviewer */}
      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Reviewer
        </label>
        <input
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
        />
      </div>

      {/* Promote checkbox */}
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={promoteToEval}
          onChange={(e) => setPromoteToEval(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-white/[0.04] text-cyan-400 accent-cyan-400 focus:outline-none"
        />
        Add my correction to the eval dataset
      </label>

      {/* Submit */}
      <div className="mt-5 flex items-center gap-3">
        <Button type="button" onClick={submit} disabled={!canSubmit}>
          {submitting ? <Loader label="Submitting" /> : "Submit feedback"}
        </Button>
        {promotedNote && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Added to eval dataset
          </motion.span>
        )}
      </div>

      {submitError && (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {submitError}
        </p>
      )}

      {/* Existing feedback */}
      <div className="mt-7 border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <MessageSquare className="h-4 w-4 text-cyan-300" />
          Past feedback
        </div>

        {loading ? (
          <Loader label="Loading feedback" />
        ) : loadError ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {loadError}
          </p>
        ) : items.length === 0 ? (
          <EmptyState>No feedback yet. Be the first to rate this RCA.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {items.map((f) => (
              <li
                key={f.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={verdictTone(f.verdict)}>
                    {f.verdict.replace(/_/g, " ")}
                  </Badge>
                  {f.rating != null && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                      <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                      {f.rating}/5
                    </span>
                  )}
                  {f.promoted_to_eval && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      promoted
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-500">
                    {timeAgo(f.created_at ?? undefined)}
                  </span>
                </div>

                {f.corrected_root_cause && (
                  <p className="mt-2.5 text-sm text-slate-300">
                    <span className="font-semibold text-slate-400">
                      Corrected:{" "}
                    </span>
                    {f.corrected_root_cause}
                  </p>
                )}
                {f.comment && (
                  <p className="mt-1.5 text-sm text-slate-400">{f.comment}</p>
                )}

                <p className="mt-2 text-xs text-slate-500">— {f.reviewer}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
