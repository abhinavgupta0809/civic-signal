import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CivicSignal — Credibility Analysis",
  description:
    "Analyze article credibility and surface checkable claims with AI-assisted signal scoring.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
