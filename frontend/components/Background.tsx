"use client";

export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* deep base */}
      <div className="absolute inset-0 bg-ink-950" />
      {/* faint grid */}
      <div className="absolute inset-0 bg-grid-faint [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
      {/* aurora blobs */}
      <div
        className="aurora-blob animate-aurora"
        style={{
          top: "-12%",
          left: "8%",
          width: "42vw",
          height: "42vw",
          background:
            "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.45), transparent 60%)",
        }}
      />
      <div
        className="aurora-blob animate-aurora"
        style={{
          top: "20%",
          right: "-8%",
          width: "38vw",
          height: "38vw",
          background:
            "radial-gradient(circle at 60% 40%, rgba(167,139,250,0.38), transparent 60%)",
          animationDelay: "-7s",
        }}
      />
      <div
        className="aurora-blob animate-aurora"
        style={{
          bottom: "-18%",
          left: "30%",
          width: "46vw",
          height: "46vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.22), transparent 62%)",
          animationDelay: "-14s",
        }}
      />
      {/* vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-950/40 to-ink-950" />
    </div>
  );
}
