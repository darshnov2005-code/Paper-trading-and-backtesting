"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortfolio } from "@/store/PortfolioContext";
import { getSimulatedPrices } from "@/lib/market-data";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { MarketSymbol } from "@/types";

export default function Dashboard() {
  const { portfolio, totalValue, totalPnL, updatePrices, resetPortfolio } = usePortfolio();
  const [markets, setMarkets] = useState<MarketSymbol[]>([]);

  useEffect(() => {
    const prices = getSimulatedPrices();
    setMarkets(prices);
    const map: Record<string, number> = {};
    prices.forEach((p) => (map[p.symbol] = p.price));
    updatePrices(map);

    const id = setInterval(() => {
      const next = getSimulatedPrices();
      setMarkets(next);
      const m: Record<string, number> = {};
      next.forEach((p) => (m[p.symbol] = p.price));
      updatePrices(m);
    }, 15000);
    return () => clearInterval(id);
  }, [updatePrices]);

  const positions = Object.values(portfolio.positions);
  const recentTrades = portfolio.trades.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">Paper trading account · Simulated market data</p>
        </div>
        <div className="flex gap-2">
          <Link href="/trade" className="btn btn-primary">
            Trade Now
          </Link>
          <button
            onClick={() => {
              if (confirm("Reset portfolio to $100,000? This cannot be undone.")) {
                resetPortfolio();
              }
            }}
            className="btn btn-secondary"
          >
            Reset Account
          </button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-zinc-500">Total Value</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500">Cash</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(portfolio.cash)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500">Total P&amp;L</p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold",
              totalPnL.value >= 0 ? "text-emerald-600" : "text-red-600"
            )}
          >
            {formatCurrency(totalPnL.value)}{" "}
            <span className="text-base font-normal">({formatPercent(totalPnL.percent)})</span>
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500">Open Positions</p>
          <p className="mt-1 text-2xl font-semibold">{positions.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Positions</h2>
            <Link href="/portfolio" className="text-sm text-emerald-600 hover:underline">
              View all
            </Link>
          </div>
          {positions.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No open positions.{" "}
              <Link href="/trade" className="text-emerald-600 hover:underline">
                Start trading
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700">
                    <th className="pb-2 font-medium">Symbol</th>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 font-medium">Avg Cost</th>
                    <th className="pb-2 font-medium">Price</th>
                    <th className="pb-2 font-medium">P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2.5 font-medium">{p.symbol}</td>
                      <td className="py-2.5">{p.quantity.toFixed(4)}</td>
                      <td className="py-2.5">{formatCurrency(p.avgCost)}</td>
                      <td className="py-2.5">{formatCurrency(p.currentPrice)}</td>
                      <td
                        className={cn(
                          "py-2.5",
                          p.unrealizedPnL >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {formatCurrency(p.unrealizedPnL)} ({formatPercent(p.unrealizedPnLPercent)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 font-semibold">Recent Trades</h2>
          {recentTrades.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No trades yet</p>
          ) : (
            <ul className="space-y-3">
              {recentTrades.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span
                      className={cn(
                        "mr-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                        t.side === "buy"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      )}
                    >
                      {t.side.toUpperCase()}
                    </span>
                    <span className="font-medium">{t.symbol}</span>
                    <span className="text-zinc-500"> × {t.quantity.toFixed(2)}</span>
                  </div>
                  <span>{formatCurrency(t.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Market Overview</h2>
          <Link href="/markets" className="text-sm text-emerald-600 hover:underline">
            All markets
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {markets.slice(0, 8).map((m) => (
            <Link
              key={m.symbol}
              href={`/trade?symbol=${m.symbol}`}
              className="rounded-lg border border-zinc-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-zinc-800 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/30"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.symbol}</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    m.changePercent >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {formatPercent(m.changePercent)}
                </span>
              </div>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(m.price)}</p>
              <p className="text-xs text-zinc-500">{m.name}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
