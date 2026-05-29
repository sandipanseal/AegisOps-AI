"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toneClasses, type Tone } from "@/lib/format";

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  type?: "button" | "submit";
};

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
}: ButtonProps) {
  const styles: Record<string, string> = {
    primary:
      "bg-gradient-to-br from-cyan-400 to-cyan-500 text-ink-950 shadow-glow hover:from-cyan-300 hover:to-cyan-400",
    ghost:
      "border border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-400/40 hover:bg-white/[0.06]",
    danger:
      "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  };
  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled ? 1 : 1.03 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function Card({
  children,
  className = "",
  delay = 0,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  interactive?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={`glass rounded-3xl p-6 shadow-panel ${interactive ? "lift" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-xl font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${toneClasses[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function AnimatedNumber({
  value,
  format = (n) => `${Math.round(n)}`,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current;
    const to = value || 0;
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else ref.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(display)}</>;
}

export function Metric({
  label,
  value,
  hint,
  delay = 0,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delay?: number;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass lift rounded-2xl p-4"
    >
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p
        className={`mt-2 text-2xl font-black tracking-tight ${
          accent ? "text-cyan-300" : "text-white"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </motion.div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`relative rounded-xl px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
            active === tab ? "text-ink-950" : "text-slate-300 hover:text-white"
          }`}
        >
          {active === tab && (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-500"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative z-10">{tab}</span>
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-white/5 bg-ink-950/80 p-3 font-mono text-xs leading-relaxed text-cyan-100/80">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function Loader({ label = "Working" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-cyan-200">
      <motion.span
        className="h-3.5 w-3.5 rounded-full border-2 border-cyan-300 border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
      />
      {label}…
    </span>
  );
}
