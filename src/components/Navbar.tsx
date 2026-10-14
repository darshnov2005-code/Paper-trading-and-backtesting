"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePortfolio } from "@/store/PortfolioContext";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/trade", label: "Trade" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/backtest", label: "Backtest" },
  { href: "/markets", label: "Markets" },
];

export function Navbar() {
  const pathname = usePathname();
  const { totalValue, totalPnL, totalPnLPercent } = usePortfolio();
  const [indices, setIndices] = useState<{ nifty: number; niftyChg: number; bank: number; bankChg: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [nRes, bRes] = await Promise.all([
          fetch("/api/quote?symbol=NIFTY"),
          fetch("/api/quote?symbol=BANKNIFTY"),
        ]);
        const n = await nRes.json();
        const b = await bRes.json();
        if (!cancelled) {
          setIndices({
            nifty: n.price || 0,
            niftyChg: n.changePercent || 0,
            bank: b.price || 0,
            bankChg: b.changePercent || 0,
          });
        }
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[#0b0e11]/95 backdrop-blur">
      <div className="border-b border-[var(--border)] bg-[#12161c]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 overflow-x-auto px-3 py-1.5 text-xs sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-[var(--muted)]">NIFTY</span>
              <span className="font-semibold">{indices ? indices.nifty.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</span>
              {indices && <span className={indices.niftyChg >= 0 ? "pos" : "neg"}>{formatPercent(indices.niftyChg)}</span>}
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-[var(--muted)]">BANKNIFTY</span>
              <span className="font-semibold">{indices ? indices.bank.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</span>
              {indices && <span className={indices.bankChg >= 0 ? "pos" : "neg"}>{formatPercent(indices.bankChg)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-[var(--muted)]">P&L</span>
            <span className={cn("font-semibold", totalPnL >= 0 ? "pos" : "neg")}>
              {formatCurrency(totalPnL)} ({formatPercent(totalPnLPercent)})
            </span>
            <span className="hidden text-[var(--muted)] sm:inline">·</span>
            <span className="hidden sm:inline">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </div>
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-3 sm:h-14 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--green)] text-xs font-bold text-[#0b0e11] sm:h-8 sm:w-8 sm:text-sm">PT</span>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-sm">PaperTrade</span>
            <span className="text-[10px] font-normal text-[var(--muted)]">India · F&O</span>
          </div>
        </Link>
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn("whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm", pathname === l.href ? "bg-[var(--green)]/15 text-[var(--green)]" : "text-[var(--muted)] hover:bg-[var(--card)] hover:text-white")}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
