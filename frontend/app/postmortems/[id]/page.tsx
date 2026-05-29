"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { api, type IncidentDetail } from "@/lib/api";
import { Button, Card, EmptyState } from "@/components/ui";

export default function PostmortemPage({
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

  async function generate() {
    try {
      await api(`/incidents/${id}/postmortem`, { method: "POST" });
      setMessage("Generated latest postmortem.");
      await load();
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  useEffect(() => {
    load().catch(() => setMessage("Backend unreachable."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 pb-20 pt-8 md:px-8">
      <div className="flex gap-4 text-sm text-cyan-300">
        <Link href="/" className="inline-flex items-center gap-1.5 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" /> Command center
        </Link>
        <Link href={`/incidents/${id}`} className="hover:text-cyan-200">Incident detail</Link>
      </div>

      <Card delay={0}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Postmortem
        </p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Incident #{id}</h1>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={generate}>
            <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Generate / refresh</span>
          </Button>
          {message && <span className="text-sm text-emerald-300">{message}</span>}
        </div>
      </Card>

      <Card delay={0.06}>
        {detail?.postmortem ? (
          <article className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
            {detail.postmortem}
          </article>
        ) : (
          <EmptyState>No postmortem exists yet — generate one above.</EmptyState>
        )}
      </Card>
    </main>
  );
}
