"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { api, SERVICES, type Incident } from "@/lib/api";
import { severityTone, statusTone, timeAgo } from "@/lib/format";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [message, setMessage] = useState("");

  async function loadIncidents() {
    setIncidents(await api<Incident[]>("/incidents"));
  }

  async function injectFault(service: string) {
    setMessage(`Injecting fault into ${service}…`);
    try {
      const data = await api<{ mode: string }>(`/services/${service}/simulate-failure`, {
        method: "POST",
      });
      setMessage(`Injected "${data.mode}" fault into ${service}. Open a matching scenario from the command center.`);
    } catch (err: any) {
      setMessage(`Failed: ${err.message}`);
    }
  }

  useEffect(() => {
    loadIncidents().catch(() => setMessage("Backend unreachable."));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 md:px-8">
      <Card delay={0}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Incident Center
        </p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">All incidents</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Review RCA status, generated postmortems, timelines, and runbook history across
          every incident.
        </p>
      </Card>

      <Card delay={0.06} className="mt-6">
        <SectionTitle eyebrow="Chaos testing" title="Fault injection" />
        <p className="-mt-2 mb-4 text-sm text-slate-400">
          Inject a realistic fault into a monitored service, then open the matching scenario
          to drive the agentic workflow with live signals.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {SERVICES.map((service) => (
            <Button key={service} variant="ghost" onClick={() => injectFault(service)}>
              <span className="inline-flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-300" /> {service}
              </span>
            </Button>
          ))}
        </div>
        {message && (
          <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-cyan-200">
            {message}
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-3">
        {incidents.length === 0 && (
          <Card delay={0.1}>
            <EmptyState>No incidents yet. Open scenarios from the command center.</EmptyState>
          </Card>
        )}
        {incidents.map((item, i) => (
          <Link key={item.id} href={`/incidents/${item.id}`}>
            <Card delay={Math.min(i * 0.03, 0.2)} interactive className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-white">
                    #{item.id} {item.title}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <span className="font-mono text-cyan-300">{item.service_name}</span>
                    <Badge tone={severityTone(item.severity)}>{item.severity}</Badge>
                    <span>{timeAgo(item.created_at)}</span>
                  </div>
                </div>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
