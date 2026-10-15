"use client";

import { useState } from "react";
import { runBacktest } from "@/lib/backtest";
import { POPULAR_SYMBOLS } from "@/lib/market-data";
import { MiniChart } from "@/components/MiniChart";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { BacktestConfig, BacktestResult } from "@/types";

export default function BacktestPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [strategy, setStrategy] = useState<BacktestConfig["strategy"]>("sma_crossover");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-12-31");
  const [capital, setCapital] = useState("1000000");
  const [shortPeriod, setShortPeriod] = useState("9");
  const [longPeriod, setLongPeriod] = useState("21");
  const [rsiPeriod, setRsiPeriod] = useState("14");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const res = runBacktest({
        symbol,
        strategy,
        startDate,
        endDate,
        initialCapital: parseFloat(capital) || 1_000_000,
        shortPeriod: parseInt(shortPeriod) || 9,
        longPeriod: parseInt(longPeriod) || 21,
        rsiPeriod: parseInt(rsiPeriod) || 14,
        overbought: 70,
        oversold: 30,
        feesPercent: 0.03,
      });
      setResult(res);
      setRunning(false);
    }, 50);
  };

  const chartCandles =
    result?.equityCurve.map((e, i, arr) => ({
      time: e.time,
      open: i === 0 ? e.equity : arr[i - 1].equity,
      high: Math.max(e.equity, i === 0 ? e.equity : arr[i - 1].equity),
      low: Math.min(e.equity, i === 0 ? e.equity : arr[i - 1].equity),
      close: e.equity,
      volume: 0,
    })) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold sm:text-xl">Backtest</h1>
        <p className="text-xs text-[var(--muted)]">Test strategies on historical Indian market data</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="card lg:col-span-4 space-y-3">
          <h2 className="text-sm font-semibold">Configuration</h2>

          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Symbol</label>
            <select
              className="input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {POPULAR_SYMBOLS.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Strategy</label>
            <select
              className="input"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as BacktestConfig["strategy"])}
            >
              <option value="sma_crossover">SMA Crossover</option>
              <option value="rsi">RSI</option>
              <option value="buy_hold">Buy & Hold</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Start</label>
              <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">End</label>
              <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Initial capital (₹)</label>
            <input type="number" className="input" value={capital} onChange={(e) => setCapital(e.target.value)} />
          </div>

          {strategy === "sma_crossover" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Short SMA</label>
                <input type="number" className="input" value={shortPeriod} onChange={(e) => setShortPeriod(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Long SMA</label>
                <input type="number" className="input" value={longPeriod} onChange={(e) => setLongPeriod(e.target.value)} />
              </div>
            </div>
          )}

          {strategy === "rsi" && (
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">RSI period</label>
              <input type="number" className="input" value={rsiPeriod} onChange={(e) => setRsiPeriod(e.target.value)} />
            </div>
          )}

          <button onClick={run} disabled={running} className="btn btn-primary w-full py-2.5 font-bold">
            {running ? "Running…" : "Run Backtest"}
          </button>
        </div>

        <div className="lg:col-span-8 space-y-4">
          {!result ? (
            <div className="card py-16 text-center text-sm text-[var(--muted)]">
              Configure strategy and click <span className="text-white font-medium">Run Backtest</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="card">
                  <div className="text-[10px] text-[var(--muted)]">Total Return</div>
                  <div className={cn("text-lg font-bold", result.metrics.totalReturn >= 0 ? "pos" : "neg")}>
                    {formatCurrency(result.metrics.totalReturn)}
                  </div>
                  <div className={cn("text-xs", result.metrics.totalReturnPercent >= 0 ? "pos" : "neg")}>
                    {formatPercent(result.metrics.totalReturnPercent)}
                  </div>
                </div>
                <div className="card">
                  <div className="text-[10px] text-[var(--muted)]">Max Drawdown</div>
                  <div className="text-lg font-bold neg">{result.metrics.maxDrawdown.toFixed(1)}%</div>
                </div>
                <div className="card">
                  <div className="text-[10px] text-[var(--muted)]">Win Rate</div>
                  <div className="text-lg font-bold">{result.metrics.winRate.toFixed(1)}%</div>
                  <div className="text-[10px] text-[var(--muted)]">{result.metrics.totalTrades} trades</div>
                </div>
                <div className="card">
                  <div className="text-[10px] text-[var(--muted)]">Sharpe / PF</div>
                  <div className="text-lg font-bold">{result.metrics.sharpeRatio}</div>
                  <div className="text-[10px] text-[var(--muted)]">PF {result.metrics.profitFactor}</div>
                </div>
              </div>

              <div className="card">
                <h3 className="mb-2 text-sm font-semibold">Equity Curve</h3>
                {chartCandles.length > 2 ? (
                  <MiniChart candles={chartCandles} height={240} />
                ) : (
                  <p className="py-8 text-center text-sm text-[var(--muted)]">Not enough data</p>
                )}
              </div>

              <div className="card overflow-x-auto">
                <h3 className="mb-2 text-sm font-semibold">Trades ({result.trades.length})</h3>
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                      <th className="py-1.5 text-left">Date</th>
                      <th className="py-1.5 text-left">Side</th>
                      <th className="py-1.5 text-right">Price</th>
                      <th className="py-1.5 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 40).map((t, i) => (
                      <tr key={i} className="border-b border-[var(--border)]/40">
                        <td className="py-1.5">{new Date(t.time * 1000).toLocaleDateString("en-IN")}</td>
                        <td className={cn("py-1.5 font-semibold", t.side === "buy" ? "pos" : "neg")}>
                          {t.side.toUpperCase()}
                        </td>
                        <td className="py-1.5 text-right">{formatCurrency(t.price)}</td>
                        <td className="py-1.5 text-right">{t.quantity.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
