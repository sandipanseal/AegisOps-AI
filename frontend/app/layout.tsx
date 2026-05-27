import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AegisOps AI",
  description: "Agentic AI Incident Commander for Production Systems",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
