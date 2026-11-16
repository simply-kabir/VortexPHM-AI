import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "VortexPHM-AI: Aero-engine health and decision support",
  description: "Anomaly detection, fault isolation, explainable AI and a human-in-the-loop maintenance cockpit for turbofan engines.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-fg" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="vortex-theme-v2">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
