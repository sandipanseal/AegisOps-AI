"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Boxes, FileText } from "lucide-react";
import { api, type IncidentDetail } from "@/lib/api";
import { pct, severityTone, statusTone, timeAgo } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  JsonBlock,
  Metric,
  SectionTitle,
} from "@/components/ui";
import { LifecyclePanel } from "@/components/incident/LifecyclePanel";
import { SlaPanel } from "@/components/incident/SlaPanel";
import { ConfidencePanel } from "@/components/incident/ConfidencePanel";
import { RcaFeedbackPanel } from "@/components/incident/RcaFeedbackPanel";
import { RunbookRiskPanel } from "@/components/incident/RunbookRiskPanel";

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setDetail(await api<IncidentDetail>(`/incidents/${id}`));
  }

  async function generatePostmortem() {
    try {
      await api(`/incidents/${id}/postmortem`, { method: "POST" });
      setMessage("Postmortem generated.");
      await load();
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  useEffect(() => {
    load().catch(() => setMessage("Backend unreachable."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!detail?.incident) {
    return (
      <main className="mx-auto max-w-6xl px-5 pt-10 text-slate-400 md:px-8">Loading…</main>
    );
  }

  const incident = detail.incident;
  const incidentId = Number(id);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 pb-20 pt-8 md:px-8">
      <div className="flex flex-wrap gap-4 text-sm text-cyan-300">
        <Link href="/" className="inline-flex items-center gap-1.5 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" /> Command center
        </Link>
        <Link href="/incidents" className="hover:text-cyan-200">Incident center</Link>
        <Link href={`/postmortems/${incident.id}`} className="hover:text-cyan-200">Postmortem</Link>
      </div>

      <Card delay={0}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Incident detail
        </p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
          #{incident.id} {incident.title}
        </h1>
        <p className="mt-2 text-slate-300">{incident.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Service" value={<span className="font-mono text-base text-cyan-300">{incident.service_name}</span>} />
          <Metric label="Severity" value={<Badge tone={severityTone(incident.severity)}>{incident.severity}</Badge>} />
          <Metric label="Status" value={<Badge tone={statusTone(incident.status)}>{incident.status}</Badge>} />
          <Metric label="Scenario" value={<span className="font-mono text-sm text-slate-200">{incident.scenario_key}</span>} />
        </div>
        <div className="mt-5">
          <Button onClick={generatePostmortem}>
            <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Generate postmortem</span>
          </Button>
          {message && <span className="ml-3 text-sm text-emerald-300">{message}</span>}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <LifecyclePanel incidentId={incidentId} onChanged={load} />
        <SlaPanel incidentId={incidentId} />
      </div>

      <Card delay={0.05}>
        <SectionTitle eyebrow="Synthesis" title="Root-cause analysis" />
        {detail.rca ? (
          <div>
            <p className="text-2xl font-black text-cyan-300">{pct(detail.rca.confidence_score)} confidence</p>
            <p className="mt-3 text-sm leading-7 text-slate-200">{detail.rca.suspected_root_cause}</p>
          </div>
        ) : (
          <EmptyState>No RCA generated yet.</EmptyState>
        )}
      </Card>

      <ConfidencePanel explanation={detail.rca?.confidence_explanation} />

      <Card delay={0.08}>
        <SectionTitle eyebrow="Signals" title="Evidence records" />
        {detail.evidence.length === 0 ? (
          <EmptyState>No evidence recorded.</EmptyState>
        ) : (
          <div className="grid gap-3">
            {detail.evidence.map((item, index) => (
              <div key={index} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="font-mono text-sm font-bold text-cyan-300">{item.source}</p>
                <p className="mt-1 text-sm text-slate-200">{item.summary}</p>
                <JsonBlock data={item.details} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card delay={0.11}>
        <SectionTitle eyebrow="Execution" title="Agent traces" />
        {detail.agent_traces.length === 0 ? (
          <EmptyState>No agent traces recorded.</EmptyState>
        ) : (
          <div className="grid gap-3">
            {detail.agent_traces.map((item, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold text-white">
                    <Boxes className="h-4 w-4 text-cyan-300" /> {item.agent_name}
                  </span>
                  <span className="text-xs text-slate-400">{Math.round(item.latency_ms)} ms</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.output_summary}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <RcaFeedbackPanel incidentId={incidentId} onSubmitted={load} />

      <RunbookRiskPanel />

      <Card delay={0.14}>
        <SectionTitle eyebrow="History" title="Timeline" />
        <ol className="relative space-y-3 border-l border-white/10 pl-5">
          {detail.timeline.map((item, index) => (
            <li key={index} className="relative">
              <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-400 ring-4 ring-ink-950" />
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-semibold text-white">
                  {item.event_type} <span className="text-slate-400">by {item.actor}</span>
                </p>
                <p className="text-sm text-slate-300">{item.message}</p>
                <p className="mt-1 text-xs text-slate-500">{timeAgo(item.created_at)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </main>
  );
}
