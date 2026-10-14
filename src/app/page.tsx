"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortfolio } from "@/store/PortfolioContext";
import { getSimulatedPrices } from "@/lib/market-data";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { MarketSymbol } from "@/types";

export default function Dashboard() {
  const { portfolio, totalValue, totalPnL, totalPnLPercent, updatePrices, resetPortfolio } = usePortfolio();
  const [markets, setMarkets] = useState<MarketSymbol[]>([]);
  const [filter, setFilter] = useState<"all" | "index" | "stock">("all");

  useEffect(() => {
    const load = () => {
      const prices = getSimulatedPrices();
      setMarkets(prices);
      const map: Record<string, number> = {};
      prices.forEach((p) => (map[p.symbol] = p.price));
      updatePrices(map);
    };
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [updatePrices]);

  const positions = Object.values(portfolio.positions);
  const recentTrades = portfolio.trades.slice(0, 6);
  const indices = markets.filter((m) => m.type === "index");
  const stocks = markets.filter((m) => m.type === "stock");
  const displayMarkets = filter === "index" ? indices : filter === "stock" ? stocks : markets;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--muted)]">NSE · F&O · Intraday · Futures · Paper Trading</p>
        </div>
        <div className="flex gap-2">
          <Link href="/trade" className="btn btn-primary">Trade Now</Link>
          <button
            onClick={() => { if (confirm("Reset paper account to ₹10,00,000?")) resetPortfolio(); }}
            className="btn btn-secondary"
          >Reset Account</button>
        </div>
      </div>

      <div className="mb-6 flex gap-3 overflow-x-auto pb-1">
        {indices.map((idx) => (
          <Link key={idx.symbol} href={`/trade?symbol=${idx.symbol}`} className="card card-hover flex min-w-[160px] flex-col gap-0.5 px-4 py-3">
            <span className="text-xs font-medium text-[var(--muted)]">{idx.symbol}</span>
            <span className="text-lg font-semibold">{new Intl.NumberFormat("en-IN").format(idx.price)}</span>
            <span className={cn("text-xs font-medium", idx.changePercent >= 0 ? "pos" : "neg")}>{formatPercent(idx.changePercent)}</span>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card"><p className="text-xs text-[var(--muted)]">Total Value</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totalValue)}</p></div>
        <div className="card"><p className="text-xs text-[var(--muted)]">Available Cash</p><p className="mt-1 text-2xl font-bold">{formatCurrency(portfolio.cash)}</p></div>
        <div className="card"><p className="text-xs text-[var(--muted)]">Total P&L</p><p className={cn("mt-1 text-2xl font-bold", totalPnL >= 0 ? "pos" : "neg")}>{formatCurrency(totalPnL)} <span className="text-sm font-medium">({formatPercent(totalPnLPercent)})</span></p></div>
        <div className="card"><p className="text-xs text-[var(--muted)]">Open Positions</p><p className="mt-1 text-2xl font-bold">{positions.length}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Positions</h2>
            <Link href="/portfolio" className="text-sm text-[var(--green)] hover:underline">View all →</Link>
          </div>
          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-[var(--muted)]">No open positions</p>
              <Link href="/trade" className="mt-3 btn btn-primary text-sm">Start Trading</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <th className="pb-2 font-medium">Symbol</th><th className="pb-2 font-medium">Qty</th><th className="pb-2 font-medium">Avg</th><th className="pb-2 font-medium">LTP</th><th className="pb-2 font-medium">P&L</th>
                </tr></thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol} className="border-b border-[var(--border)]/50">
                      <td className="py-3 font-medium">{p.symbol}</td>
                      <td className="py-3">{p.quantity}</td>
                      <td className="py-3">{new Intl.NumberFormat("en-IN").format(p.avgCost)}</td>
                      <td className="py-3">{new Intl.NumberFormat("en-IN").format(p.currentPrice)}</td>
                      <td className={cn("py-3 font-medium", p.unrealizedPnL >= 0 ? "pos" : "neg")}>{formatCurrency(p.unrealizedPnL)} <span className="text-xs">({formatPercent(p.unrealizedPnLPercent)})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 font-semibold">Recent Trades</h2>
          {recentTrades.length === 0 ? <p className="py-10 text-center text-sm text-[var(--muted)]">No trades yet</p> : (
            <ul className="space-y-3">
              {recentTrades.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", t.side === "buy" ? "bg-[var(--green)]/20 text-[var(--green)]" : "bg-[var(--red)]/20 text-[var(--red)]")}>{t.side}</span>
                    <span className="font-medium">{t.symbol}</span>
                    <span className="text-[var(--muted)]">×{t.quantity}</span>
                  </div>
                  <span>{formatCurrency(t.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Market Watch</h2>
          <div className="flex gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {(["all", "index", "stock"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize transition", filter === f ? "bg-[var(--green)] text-[#0b0e11]" : "text-[var(--muted)] hover:text-white")}>{f === "all" ? "All" : f === "index" ? "Indices" : "Stocks"}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {displayMarkets.map((m) => (
            <Link key={m.symbol} href={`/trade?symbol=${m.symbol}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5 transition hover:border-[var(--green)]/40 hover:bg-[var(--card-hover)]">
              <div><div className="font-medium">{m.symbol}</div><div className="text-xs text-[var(--muted)]">{m.name}</div></div>
              <div className="text-right"><div className="font-semibold">{new Intl.NumberFormat("en-IN").format(m.price)}</div><div className={cn("text-xs font-medium", m.changePercent >= 0 ? "pos" : "neg")}>{formatPercent(m.changePercent)}</div></div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
