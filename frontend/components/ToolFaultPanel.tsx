"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, Wrench } from "lucide-react";
import { api, json, type ToolFault } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Loader, SectionTitle } from "@/components/ui";

const TOOLS = ["loki", "kubernetes", "service", "inferops", "rag"] as const;

export function ToolFaultPanel() {
  const [tools, setTools] = useState<ToolFault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ tools: ToolFault[] }>("/tools/faults");
      setTools(res.tools ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tool faults");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (tool: ToolFault) => {
      setPending(tool.tool);
      setError(null);
      try {
        if (tool.active) {
          await api(`/tools/${tool.tool}/reset`, { method: "POST" });
        } else {
          await api(`/tools/${tool.tool}/simulate-failure`, json({ active: true }));
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update tool state");
      } finally {
        setPending(null);
      }
    },
    [load]
  );

  // Preserve a stable ordering using the known tool catalogue, falling back to
  // any additional tools the backend reports.
  const ordered: ToolFault[] = [
    ...TOOLS.map((name) => tools.find((t) => t.tool === name)).filter(
      (t): t is ToolFault => Boolean(t)
    ),
    ...tools.filter((t) => !TOOLS.includes(t.tool as (typeof TOOLS)[number])),
  ];

  return (
    <Card>
      <SectionTitle eyebrow="Chaos" title="Tool failure simulation" />
      <p className="text-sm text-slate-300">
        Marking a tool as failing forces the platform onto its graceful-degradation
        fallback path.
      </p>

      <div className="mt-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader label="Loading tools" />
          </div>
        ) : ordered.length === 0 ? (
          <EmptyState>No tools available to simulate.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {ordered.map((tool, i) => (
              <motion.li
                key={tool.tool}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Wrench className="h-4 w-4 shrink-0 text-cyan-300" />
                    <span className="truncate font-mono text-sm font-semibold text-white">
                      {tool.tool}
                    </span>
                    <Badge tone={tool.active ? "critical" : "resolved"}>
                      {tool.active ? "failing" : "healthy"}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">{tool.fallback}</p>
                </div>

                <Button
                  variant={tool.active ? "ghost" : "danger"}
                  onClick={() => void toggle(tool)}
                  disabled={pending === tool.tool}
                  className="shrink-0"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {tool.active ? (
                      <RotateCcw className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {pending === tool.tool
                      ? "Working…"
                      : tool.active
                      ? "Reset"
                      : "Simulate failure"}
                  </span>
                </Button>
              </motion.li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

export default ToolFaultPanel;
