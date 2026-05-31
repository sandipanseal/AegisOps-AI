"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, BarChart3, Boxes, Gauge, LineChart, Network, Plug, Rocket } from "lucide-react";
import { GRAFANA_URL } from "@/lib/api";

const links = [
  { href: "/", label: "Command", icon: Activity },
  { href: "/incidents", label: "Incidents", icon: Boxes },
  { href: "/sla", label: "SLA", icon: Gauge },
  { href: "/dependencies", label: "Dependencies", icon: Network },
  { href: "/canary", label: "Canary", icon: Rocket },
  { href: "/evals", label: "Evaluations", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 md:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-glow">
            <Activity className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-ink-950 animate-pulse-soft" />
          </span>
          <span className="text-sm font-black tracking-tight text-white">
            AegisOps<span className="text-cyan-300">AI</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl border border-cyan-400/30 bg-cyan-400/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <a
            href={GRAFANA_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-white"
          >
            <LineChart className="h-4 w-4" />
            <span className="hidden sm:inline">Grafana</span>
          </a>
          <span className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
            v1.0.0
          </span>
        </div>
      </div>
    </header>
  );
}
