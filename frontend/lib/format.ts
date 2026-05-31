export function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type Tone = "critical" | "high" | "medium" | "low" | "resolved" | "neutral";

export function severityTone(severity?: string): Tone {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "neutral";
  }
}

export function statusTone(status?: string): Tone {
  switch ((status || "").toLowerCase()) {
    case "resolved":
      return "resolved";
    case "investigating":
      return "high";
    case "open":
      return "medium";
    default:
      return "neutral";
  }
}

export const toneClasses: Record<Tone, string> = {
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  neutral: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function pct(value?: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

// Lifecycle status -> tone (extends statusTone with the richer lifecycle states).
export function lifecycleTone(status?: string): Tone {
  switch ((status || "").toLowerCase()) {
    case "resolved":
    case "closed":
      return "resolved";
    case "investigating":
    case "identified":
    case "mitigating":
      return "high";
    case "acknowledged":
      return "medium";
    case "open":
      return "critical";
    default:
      return "neutral";
  }
}

// SLA / canary signal status -> tone.
export function slaTone(status?: string): Tone {
  switch ((status || "").toLowerCase()) {
    case "met":
      return "resolved";
    case "on_track":
    case "ok":
      return "resolved";
    case "at_risk":
    case "warn":
      return "medium";
    case "breached":
    case "regression":
      return "critical";
    default:
      return "neutral";
  }
}

export function riskTone(band?: string): Tone {
  switch ((band || "").toLowerCase()) {
    case "high":
      return "critical";
    case "medium":
      return "medium";
    case "low":
      return "resolved";
    default:
      return "neutral";
  }
}

export function verdictTone(verdict?: string): Tone {
  switch ((verdict || "").toLowerCase()) {
    case "promote":
    case "accurate":
      return "resolved";
    case "hold":
    case "partially_accurate":
      return "medium";
    case "rollback":
    case "inaccurate":
      return "critical";
    default:
      return "neutral";
  }
}

// Format a duration in seconds as a compact human string (supports negatives).
export function duration(seconds?: number | null): string {
  if (seconds == null) return "—";
  const neg = seconds < 0;
  let s = Math.abs(Math.round(seconds));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!d && !h) parts.push(`${s}s`);
  return (neg ? "-" : "") + parts.slice(0, 2).join(" ");
}
