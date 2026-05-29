import type { Metadata } from "next";
import "./globals.css";
import { Background } from "@/components/Background";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "AegisOps AI — Agentic Incident Commander",
  description:
    "Agentic AI incident response platform: multi-agent evidence collection, root-cause analysis, safety-gated runbooks, postmortems, and live observability.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Background />
        <Nav />
        {children}
      </body>
    </html>
  );
}
