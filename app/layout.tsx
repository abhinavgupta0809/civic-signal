import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CivicSignal — Credibility Analysis",
  description:
    "Analyze article credibility and surface checkable claims with AI-assisted signal scoring.",
};

// Applies the stored (or system) theme before first paint to avoid a flash.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("civicsignal-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${sourceSerif.variable} flex min-h-screen flex-col font-sans`}
      >
        <SiteHeader />
        <div className="flex-grow">{children}</div>
        <footer className="mx-auto w-full max-w-reading border-t border-border px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
            <p className="text-sm text-muted">
              An assistive credibility signal, not a final source of truth.
            </p>
            <nav className="flex gap-4 text-xs font-semibold text-muted">
              <a
                href="https://mediabiasfactcheck.com/methodology/"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-primary"
              >
                Methodology
              </a>
              <a
                href="https://github.com/abhinavgupta0809/civic-signal"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-primary"
              >
                GitHub
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
