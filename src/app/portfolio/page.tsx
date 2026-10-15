"use client";

import { usePortfolio } from "@/store/PortfolioContext";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { MiniChart } from "@/components/MiniChart";
import { useMemo } from "react";

export default function PortfolioPage() {
  const { portfolio, totalValue, totalPnL, totalPnLPercent, analytics, resetPortfolio } = usePortfolio();
  const positions = Object.values(portfolio.positions);

  const equityCandles = useMemo(() => {
    let equity = portfolio.initialCash;
    const points: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
    const sorted = [...portfolio.trades].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length === 0) {
      const now = Date.now() / 1000;
      for (let i = 0; i < 10; i++) {
        points.push({ time: now - (10 - i) * 86400, open: equity, high: equity, low: equity, close: equity, volume: 0 });
      }
      return points;
    }
    for (const t of sorted) {
      if (t.side === "buy") equity -= t.total;
      else equity += t.total;
      const prev = points[points.length - 1]?.close ?? portfolio.initialCash;
      points.push({
        time: t.timestamp / 1000,
        open: prev,
        high: Math.max(prev, equity),
        low: Math.min(prev, equity),
        close: equity,
        volume: 0,
      });
    }
    const last = points[points.length - 1];
    if (last) {
      points.push({
        time: Date.now() / 1000,
        open: last.close,
        high: Math.max(last.close, totalValue),
        low: Math.min(last.close, totalValue),
        close: totalValue,
        volume: 0,
      });
    }
    return points.slice(-40);
  }, [portfolio.trades, portfolio.initialCash, totalValue]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold sm:text-xl">Portfolio</h1>
          <p className="text-xs text-[var(--muted)]">Positions · Analytics · History</p>
        </div>
        <button
          onClick={() => {
            if (confirm("Reset paper account to ₹10 Lakh?")) resetPortfolio();
          }}
          className="btn btn-secondary text-xs"
        >
          Reset Account
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card">
          <div className="text-[10px] text-[var(--muted)]">Total Value</div>
          <div className="text-base font-bold sm:text-lg">{formatCurrency(totalValue)}</div>
        </div>
        <div className="card">
          <div className="text-[10px] text-[var(--muted)]">Cash</div>
          <div className="text-base font-bold sm:text-lg">{formatCurrency(portfolio.cash)}</div>
        </div>
        <div className="card">
          <div className="text-[10px] text-[var(--muted)]">Total P&L</div>
          <div className={cn("text-base font-bold sm:text-lg", totalPnL >= 0 ? "pos" : "neg")}>
            {formatCurrency(totalPnL)}
          </div>
          <div className={cn("text-[10px]", totalPnLPercent >= 0 ? "pos" : "neg")}>
            {formatPercent(totalPnLPercent)}
          </div>
        </div>
        <div className="card">
          <div className="text-[10px] text-[var(--muted)]">Realized P&L</div>
          <div className={cn("text-base font-bold sm:text-lg", analytics.realizedPnL >= 0 ? "pos" : "neg")}>
            {formatCurrency(analytics.realizedPnL)}
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="text-[10px] text-[var(--muted)]">Win Rate</div>
          <div className="text-xl font-bold">{analytics.winRate.toFixed(1)}%</div>
          <div className="text-[10px] text-[var(--muted)]">
            {analytics.winningTrades}W / {analytics.losingTrades}L
          </div>
        </div>
        <div className="card">
          <div className="text-[10px] text-[var(--muted)]">Closed Trades</div>
          <div className="text-xl font-bold">{analytics.totalTrades}</div>
        </div>
        <div className="card">
          <div className="text-[10px] text-[var(--muted)]">Avg Win / Loss</div>
          <div className="text-sm font-bold">
            <span className="pos">{formatCurrency(analytics.avgWin)}</span>
            {" / "}
            <span className="neg">{formatCurrency(analytics.avgLoss)}</span>
          </div>
        </div>
        <div className="card">
          <div className="text-[10px] text-[var(--muted)]">Profit Factor</div>
          <div className="text-xl font-bold">{analytics.profitFactor.toFixed(2)}</div>
        </div>
      </div>

      <div className="card mb-5">
        <h2 className="mb-2 text-sm font-semibold">Equity Curve</h2>
        <MiniChart candles={equityCandles} height={200} />
      </div>

      {analytics.dailyPnL.length > 0 && (
        <div className="card mb-5">
          <h2 className="mb-3 text-sm font-semibold">Daily P&L</h2>
          <div className="flex flex-wrap gap-2">
            {analytics.dailyPnL.slice(-14).map((d) => (
              <div
                key={d.date}
                className={cn(
                  "rounded-lg px-3 py-2 text-center text-xs",
                  d.pnl >= 0 ? "bg-[var(--green)]/10" : "bg-[var(--red)]/10"
                )}
              >
                <div className="text-[10px] text-[var(--muted)]">{d.date.slice(5)}</div>
                <div className={cn("font-semibold", d.pnl >= 0 ? "pos" : "neg")}>
                  {formatCurrency(d.pnl)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-5 overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Open Positions</h2>
        {positions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">No open positions</p>
        ) : (
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-2 text-left">Symbol</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Avg</th>
                <th className="py-2 text-right">LTP</th>
                <th className="py-2 text-right">P&L</th>
                <th className="py-2 text-right">SL</th>
                <th className="py-2 text-right">TGT</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className="border-b border-[var(--border)]/40">
                  <td className="py-2 font-medium">{p.symbol}</td>
                  <td className="py-2 text-right">{p.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(p.avgCost)}</td>
                  <td className="py-2 text-right">{formatCurrency(p.currentPrice)}</td>
                  <td className={cn("py-2 text-right font-semibold", p.unrealizedPnL >= 0 ? "pos" : "neg")}>
                    {formatCurrency(p.unrealizedPnL)}
                  </td>
                  <td className="py-2 text-right neg">{p.stopLoss ?? "—"}</td>
                  <td className="py-2 text-right pos">{p.target ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Trade History</h2>
        {portfolio.trades.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">No trades yet</p>
        ) : (
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-2 text-left">Time</th>
                <th className="py-2 text-left">Symbol</th>
                <th className="py-2 text-left">Side</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.trades.slice(0, 50).map((t) => (
                <tr key={t.id} className="border-b border-[var(--border)]/40">
                  <td className="py-2 text-[var(--muted)]">
                    {new Date(t.timestamp).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 font-medium">{t.symbol}</td>
                  <td className={cn("py-2 font-semibold", t.side === "buy" ? "pos" : "neg")}>
                    {t.side.toUpperCase()}
                  </td>
                  <td className="py-2 text-right">{t.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(t.price)}</td>
                  <td className={cn("py-2 text-right", (t.pnl ?? 0) >= 0 ? "pos" : "neg")}>
                    {t.pnl != null ? formatCurrency(t.pnl) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
