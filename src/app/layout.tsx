import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PortfolioProvider } from "@/store/PortfolioContext";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PaperTrade India — F&O | Intraday | Futures",
  description:
    "Paper trading platform for Indian stock markets. Trade Nifty, BankNifty, F&O stocks with virtual money. Intraday, Futures & Options practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <PortfolioProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
            PaperTrade India · Simulated NSE F&amp;O · Educational only · No real money
          </footer>
        </PortfolioProvider>
      </body>
    </html>
  );
}
