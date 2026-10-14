"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortfolio } from "@/store/PortfolioContext";
import { getSimulatedPrices } from "@/lib/market-data";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { MarketSymbol } from "@/types";

export default function HomePage() {
  const { portfolio, totalValue, totalPnL, totalPnLPercent, updatePrices, resetPortfolio, analytics } = usePortfolio();
  const [markets, setMarkets] = useState<MarketSymbol[]>([]);

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
  const indices = markets.filter((m) => m.type === "index");
  const topMovers = [...markets].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Hero */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#12161c] via-[#1e2329] to-[#0b0e11] p-5 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--green)]">
              Virtual capital · Zero risk
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Paper trade Indian markets
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
              Practice F&O, Intraday & Options on Nifty, BankNifty and stocks with ₹10 Lakh virtual money. Live-style quotes, option chain, SL/Target and backtesting.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/trade" className="btn btn-primary px-5 py-2.5 text-sm">Start Trading</Link>
              <Link href="/backtest" className="btn btn-secondary px-5 py-2.5 text-sm">Run Backtest</Link>
              <Link href="/portfolio" className="btn btn-secondary px-5 py-2.5 text-sm">Portfolio</Link>
            </div>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[#0b0e11]/80 p-4">
              <div className="text-[10px] text-[var(--muted)] sm:text-xs">Virtual Capital</div>
              <div className="mt-1 text-lg font-bold sm:text-xl">{formatCurrency(portfolio.initialCash)}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[#0b0e11]/80 p-4">
              <div className="text-[10px] text-[var(--muted)] sm:text-xs">Account Value</div>
              <div className="mt-1 text-lg font-bold sm:text-xl">{formatCurrency(totalValue)}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[#0b0e11]/80 p-4">
              <div className="text-[10px] text-[var(--muted)] sm:text-xs">Total P&L</div>
              <div className={cn("mt-1 text-lg font-bold sm:text-xl", totalPnL >= 0 ? "pos" : "neg")}>
                {formatCurrency(totalPnL)}
              </div>
              <div className={cn("text-[10px]", totalPnLPercent >= 0 ? "pos" : "neg")}>
                {formatPercent(totalPnLPercent)}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[#0b0e11]/80 p-4">
              <div className="text-[10px] text-[var(--muted)] sm:text-xs">Cash Available</div>
              <div className="mt-1 text-lg font-bold sm:text-xl">{formatCurrency(portfolio.cash)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Index strip */}
      <section className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {indices.map((idx) => (
          <Link
            key={idx.symbol}
            href={`/trade?symbol=${idx.symbol}`}
            className="card card-hover flex min-w-[140px] flex-shrink-0 flex-col gap-0.5 px-3 py-2.5 sm:min-w-[160px] sm:px-4"
          >
            <span className="text-[10px] font-medium text-[var(--muted)] sm:text-xs">{idx.symbol}</span>
            <span className="text-base font-semibold sm:text-lg">
              {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(idx.price)}
            </span>
            <span className={cn("text-[10px] font-medium sm:text-xs", idx.changePercent >= 0 ? "pos" : "neg")}>
              {formatPercent(idx.changePercent)}
            </span>
          </Link>
        ))}
      </section>

      {/* Feature cards */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/trade", title: "Options F&O", desc: "CE/PE chain, Greeks, lots, MIS & NRML", tag: "Trade" },
          { href: "/trade", title: "Intraday", desc: "MIS product, SL & Target, live-style LTP", tag: "MIS" },
          { href: "/backtest", title: "Backtesting", desc: "SMA, RSI strategies on historical data", tag: "Test" },
          { href: "/portfolio", title: "Analytics", desc: "Win rate, equity curve, daily P&L", tag: "Stats" },
        ].map((f) => (
          <Link key={f.title} href={f.href} className="card card-hover group">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--green)]">{f.tag}</div>
            <div className="font-semibold group-hover:text-[var(--green)]">{f.title}</div>
            <p className="mt-1 text-xs text-[var(--muted)]">{f.desc}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Positions */}
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold sm:text-base">Open Positions</h2>
            <Link href="/portfolio" className="text-xs text-[var(--green)] hover:underline sm:text-sm">View portfolio →</Link>
          </div>
          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-[var(--muted)]">No open positions yet</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Use ₹10 Lakh virtual capital to practice</p>
              <Link href="/trade" className="btn btn-primary mt-4 text-sm">Place first order</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="pb-2 font-medium">Symbol</th>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 font-medium">Avg</th>
                    <th className="pb-2 font-medium">LTP</th>
                    <th className="pb-2 font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol} className="border-b border-[var(--border)]/40">
                      <td className="py-2.5 font-medium">
                        <Link href={`/trade?symbol=${p.symbol.split(/\d/)[0]}`} className="hover:text-[var(--green)]">{p.symbol}</Link>
                      </td>
                      <td className="py-2.5">{p.quantity}</td>
                      <td className="py-2.5">{formatCurrency(p.avgCost)}</td>
                      <td className="py-2.5">{formatCurrency(p.currentPrice)}</td>
                      <td className={cn("py-2.5 font-medium", p.unrealizedPnL >= 0 ? "pos" : "neg")}>
                        {formatCurrency(p.unrealizedPnL)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick stats + actions */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold">Performance</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Win rate</span>
                <span className="font-medium">{analytics.winRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Closed trades</span>
                <span className="font-medium">{analytics.totalTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Realized P&L</span>
                <span className={cn("font-medium", analytics.realizedPnL >= 0 ? "pos" : "neg")}>
                  {formatCurrency(analytics.realizedPnL)}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="mb-3 text-sm font-semibold">Quick actions</h2>
            <div className="flex flex-col gap-2">
              <Link href="/trade?symbol=NIFTY" className="btn btn-primary w-full text-sm">Trade Nifty Options</Link>
              <Link href="/trade?symbol=BANKNIFTY" className="btn btn-secondary w-full text-sm">Trade BankNifty</Link>
              <button
                onClick={() => { if (confirm("Reset paper account to ₹10 Lakh?")) resetPortfolio(); }}
                className="btn btn-secondary w-full text-sm"
              >
                Reset account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Market watch */}
      <section className="mt-6 card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold sm:text-base">Market watch</h2>
          <Link href="/markets" className="text-xs text-[var(--green)] hover:underline sm:text-sm">All markets →</Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {topMovers.map((m) => (
            <Link
              key={m.symbol}
              href={`/trade?symbol=${m.symbol}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5 transition hover:border-[var(--green)]/40 hover:bg-[var(--card-hover)]"
            >
              <div>
                <div className="text-sm font-medium">{m.symbol}</div>
                <div className="text-[10px] text-[var(--muted)]">{m.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">
                  {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(m.price)}
                </div>
                <div className={cn("text-[10px] font-medium", m.changePercent >= 0 ? "pos" : "neg")}>
                  {formatPercent(m.changePercent)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <p className="mt-6 text-center text-[10px] text-[var(--muted)] sm:text-xs">
        Paper trading only · No real money · Quotes via NSE / Yahoo fallback · For education & practice
      </p>
    </div>
  );
}
