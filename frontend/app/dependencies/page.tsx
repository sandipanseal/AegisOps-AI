"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Network, Radius } from "lucide-react";
import {
  api,
  type DependencyGraph,
  type DependencyNode,
  type ServiceImpact,
} from "@/lib/api";
import { severityTone } from "@/lib/format";
import {
  AnimatedNumber,
  Badge,
  Card,
  EmptyState,
  Loader,
  SectionTitle,
} from "@/components/ui";

const TIER_ORDER = ["edge", "core", "data"] as const;

const TIER_LABELS: Record<string, string> = {
  edge: "Edge",
  core: "Core",
  data: "Data",
};

export default function DependenciesPage() {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [impact, setImpact] = useState<ServiceImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api<DependencyGraph>("/services/dependency-graph");
        if (!cancelled) setGraph(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Backend unreachable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectNode(name: string) {
    setSelected(name);
    setImpact(null);
    setImpactError("");
    setImpactLoading(true);
    try {
      const data = await api<ServiceImpact>(
        `/services/${encodeURIComponent(name)}/impact`
      );
      setImpact(data);
    } catch (err: any) {
      setImpactError(err?.message || "Failed to load impact analysis.");
    } finally {
      setImpactLoading(false);
    }
  }

  // Group nodes into tier columns, keeping the canonical order then any extras.
  const columns = useMemo(() => {
    const nodes = graph?.nodes ?? [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const tier of TIER_ORDER) {
      if (nodes.some((n) => n.tier === tier)) {
        ordered.push(tier);
        seen.add(tier);
      }
    }
    for (const n of nodes) {
      if (!seen.has(n.tier)) {
        ordered.push(n.tier);
        seen.add(n.tier);
      }
    }
    return ordered.map((tier) => ({
      tier,
      nodes: nodes.filter((n) => n.tier === tier),
    }));
  }, [graph]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 pb-20 pt-8 md:px-8">
      <Card delay={0}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Topology
        </p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white md:text-4xl">
          <Network className="h-8 w-8 text-cyan-300" /> Service dependency graph
        </h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          A tiered view of how services depend on one another. Select a node to run a
          blast-radius impact analysis and surface which downstream services would be
          affected by an outage.
        </p>
      </Card>

      {loading && (
        <Card delay={0.06}>
          <Loader label="Loading topology" />
        </Card>
      )}

      {!loading && error && (
        <Card delay={0.06}>
          <div className="flex items-center gap-2 text-sm text-rose-300">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        </Card>
      )}

      {!loading && !error && graph && graph.nodes.length === 0 && (
        <Card delay={0.06}>
          <EmptyState>No services registered in the dependency graph yet.</EmptyState>
        </Card>
      )}

      {!loading && !error && graph && graph.nodes.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card delay={0.06}>
              <SectionTitle
                eyebrow="Tiered diagram"
                title="Topology"
              >
                <span className="text-xs text-slate-500">
                  {graph.nodes.length} services · {graph.edges.length} edges
                </span>
              </SectionTitle>
              <div className="grid gap-4 md:grid-cols-3">
                {columns.map((col) => (
                  <div key={col.tier} className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {TIER_LABELS[col.tier] ?? col.tier}
                    </p>
                    {col.nodes.map((node) => (
                      <NodeCard
                        key={node.name}
                        node={node}
                        selected={selected === node.name}
                        onSelect={() => selectNode(node.name)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card delay={0.1} className="lg:sticky lg:top-6">
              <SectionTitle eyebrow="Blast radius" title="Impact analysis" />
              {!selected && (
                <EmptyState>Select a service to analyze its blast radius.</EmptyState>
              )}
              {selected && impactLoading && <Loader label="Analyzing impact" />}
              {selected && !impactLoading && impactError && (
                <div className="flex items-center gap-2 text-sm text-rose-300">
                  <AlertTriangle className="h-4 w-4" /> {impactError}
                </div>
              )}
              {selected && !impactLoading && !impactError && impact && (
                <ImpactPanel impact={impact} />
              )}
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}

function NodeCard({
  node,
  selected,
  onSelect,
}: {
  node: DependencyNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const degraded = node.health === "degraded" || node.active_incidents.length > 0;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full rounded-2xl border bg-white/[0.02] p-3 text-left transition-colors ${
        selected
          ? "border-cyan-400/60 bg-cyan-400/[0.06]"
          : degraded
          ? "border-rose-500/40 ring-1 ring-rose-500/30 hover:border-rose-400/60"
          : "border-white/10 hover:border-cyan-400/40 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm font-semibold text-white">
          {node.name}
        </span>
        <span
          title={degraded ? "Degraded" : "Healthy"}
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            degraded ? "bg-rose-400" : "bg-emerald-400"
          }`}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">{node.kind}</Badge>
        <Badge tone={node.criticality === "critical" ? "critical" : "low"}>
          {node.criticality}
        </Badge>
      </div>
      {node.depends_on.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {node.depends_on.map((dep) => (
            <p key={dep} className="truncate font-mono text-[11px] text-slate-500">
              → {dep}
            </p>
          ))}
        </div>
      )}
      {node.active_incidents.length > 0 && (
        <div className="mt-2 space-y-1">
          {node.active_incidents.map((inc) => (
            <div
              key={inc.id}
              className="flex items-center gap-1.5 text-[11px] text-rose-300"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="truncate">{inc.title}</span>
              <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
            </div>
          ))}
        </div>
      )}
    </motion.button>
  );
}

function ImpactPanel({ impact }: { impact: ServiceImpact }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-sm font-semibold text-white">{impact.service}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Radius className="h-3.5 w-3.5 text-cyan-300" /> Blast radius
        </p>
        <p className="mt-1 text-3xl font-black tracking-tight text-cyan-300">
          <AnimatedNumber value={impact.blast_radius} />
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {impact.impacted_services.length} services impacted
        </p>
      </div>

      <ChipList
        label="Impacted services"
        items={impact.impacted_services}
        danger={impact.impacted_with_active_incidents}
      />
      <ChipList label="Direct dependents" items={impact.direct_dependents} />
      <ChipList label="Depends on" items={impact.depends_on} />

      {impact.impacted_with_active_incidents.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Impacted with active incidents
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {impact.impacted_with_active_incidents.map((name) => (
              <span
                key={name}
                className="rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 font-mono text-[11px] text-rose-200"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChipList({
  label,
  items,
  danger = [],
}: {
  label: string;
  items: string[];
  danger?: string[];
}) {
  const dangerSet = useMemo(() => new Set(danger), [danger]);
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-xs text-slate-600">None</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map((name) => {
            const isDanger = dangerSet.has(name);
            return (
              <span
                key={name}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
                  isDanger
                    ? "border-rose-500/30 bg-rose-500/15 text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-slate-300"
                }`}
              >
                {name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
