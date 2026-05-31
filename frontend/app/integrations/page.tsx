"use client";

import { useState } from "react";
import { Bell, Cpu, Database, Search, Server, Zap } from "lucide-react";
import { api, SERVICES } from "@/lib/api";
import { Button, Card, SectionTitle } from "@/components/ui";
import { ToolFaultPanel } from "@/components/ToolFaultPanel";
import { InjectionScanPanel } from "@/components/InjectionScanPanel";

export default function IntegrationsPage() {
  const [serviceName, setServiceName] = useState<string>(SERVICES[0]);
  const [query, setQuery] = useState(
    "payment-service timeout restart runbook previous incident"
  );
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function call(label: string, path: string, options: RequestInit = {}) {
    setBusy(label);
    try {
      setResult(await api(path, options));
    } catch (err: any) {
      setResult({ error: err.message });
    }
    setBusy(null);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 pb-20 pt-8 md:px-8">
      <Card delay={0}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Integrations & LLMOps
        </p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Control center</h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Exercise the live integrations: Loki log search, the Kubernetes adapter,
          Slack / PagerDuty notifications, RAG memory, and InferOps model cost &
          latency tracking.
        </p>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card delay={0.04}>
          <SectionTitle eyebrow="Service" title="Service tools" />
          <select
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
          >
            {SERVICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => call("fault", `/services/${serviceName}/simulate-failure`, { method: "POST" })} disabled={busy === "fault"}>
              <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4" /> Inject + push Loki</span>
            </Button>
            <Button variant="ghost" onClick={() => call("logs", `/logs/search?service_name=${serviceName}&minutes=120`)} disabled={busy === "logs"}>
              <span className="inline-flex items-center gap-1.5"><Search className="h-4 w-4" /> Loki logs</span>
            </Button>
            <Button variant="ghost" onClick={() => call("k8s", `/kubernetes/${serviceName}/status`)} disabled={busy === "k8s"}>
              <span className="inline-flex items-center gap-1.5"><Server className="h-4 w-4" /> K8s status</span>
            </Button>
          </div>
        </Card>

        <Card delay={0.08}>
          <SectionTitle eyebrow="Alerting" title="Notifications" />
          <p className="-mt-2 text-sm text-slate-400">
            Sends live Slack / PagerDuty when env vars are set; otherwise records
            simulated events.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => call("notify", "/notifications/test", { method: "POST" })} disabled={busy === "notify"}>
              <span className="inline-flex items-center gap-1.5"><Bell className="h-4 w-4" /> Test</span>
            </Button>
            <Button variant="ghost" onClick={() => call("notify-list", "/notifications")} disabled={busy === "notify-list"}>
              View events
            </Button>
          </div>
        </Card>

        <Card delay={0.12}>
          <SectionTitle eyebrow="InferOps AI" title="Model usage" />
          <p className="-mt-2 text-sm text-slate-400">
            Latency, tokens, and cost captured from every InferOps gateway call.
          </p>
          <Button className="mt-4" onClick={() => call("usage", "/model-usage")} disabled={busy === "usage"}>
            <span className="inline-flex items-center gap-1.5"><Cpu className="h-4 w-4" /> View usage</span>
          </Button>
        </Card>
      </section>

      <Card delay={0.14}>
        <SectionTitle eyebrow="Memory" title="RAG over incidents & runbooks" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => call("reindex", "/rag/reindex", { method: "POST" })} disabled={busy === "reindex"}>
              <span className="inline-flex items-center gap-1.5"><Database className="h-4 w-4" /> Reindex</span>
            </Button>
            <Button onClick={() => call("rag", `/rag/search?query=${encodeURIComponent(query)}&limit=5`)} disabled={busy === "rag"}>
              <span className="inline-flex items-center gap-1.5"><Search className="h-4 w-4" /> Search</span>
            </Button>
          </div>
        </div>
      </Card>

      <ToolFaultPanel />

      <InjectionScanPanel />

      <Card delay={0.16}>
        <SectionTitle eyebrow="Output" title="Response" />
        <pre className="max-h-[520px] overflow-auto rounded-xl border border-white/5 bg-ink-950/80 p-4 font-mono text-xs leading-relaxed text-cyan-100/80">
          {result ? JSON.stringify(result, null, 2) : "Run an integration to see the response."}
        </pre>
      </Card>
    </main>
  );
}
