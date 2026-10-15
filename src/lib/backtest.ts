import type { BacktestConfig, BacktestResult, Candle } from "@/types";
import { generateHistoricalCandles, sma, rsi } from "./market-data";

export function runBacktest(config: BacktestConfig): BacktestResult {
  const candles = generateHistoricalCandles(config.symbol, config.startDate, config.endDate, 1);
  if (candles.length < 30) {
    return emptyResult(config);
  }

  const closes = candles.map((c) => c.close);
  const shortP = config.shortPeriod ?? 9;
  const longP = config.longPeriod ?? 21;
  const rsiP = config.rsiPeriod ?? 14;
  const feesPct = (config.feesPercent ?? 0.03) / 100;

  let signal: ("buy" | "sell" | "hold")[] = closes.map(() => "hold");

  if (config.strategy === "sma_crossover") {
    const shortSma = sma(closes, shortP);
    const longSma = sma(closes, longP);
    for (let i = 1; i < closes.length; i++) {
      if (shortSma[i] == null || longSma[i] == null || shortSma[i - 1] == null || longSma[i - 1] == null) continue;
      if (shortSma[i - 1]! <= longSma[i - 1]! && shortSma[i]! > longSma[i]!) signal[i] = "buy";
      else if (shortSma[i - 1]! >= longSma[i - 1]! && shortSma[i]! < longSma[i]!) signal[i] = "sell";
    }
  } else if (config.strategy === "rsi") {
    const r = rsi(closes, rsiP);
    const ob = config.overbought ?? 70;
    const os = config.oversold ?? 30;
    for (let i = 1; i < closes.length; i++) {
      if (r[i] == null || r[i - 1] == null) continue;
      if (r[i - 1]! < os && r[i]! >= os) signal[i] = "buy";
      else if (r[i - 1]! > ob && r[i]! <= ob) signal[i] = "sell";
    }
  } else if (config.strategy === "buy_hold") {
    signal[0] = "buy";
  }

  let cash = config.initialCapital;
  let qty = 0;
  let entryPrice = 0;
  const trades: BacktestResult["trades"] = [];
  const equityCurve: BacktestResult["equityCurve"] = [];
  const startPrice = closes[0];

  for (let i = 0; i < candles.length; i++) {
    const price = closes[i];
    if (signal[i] === "buy" && qty === 0 && cash > 0) {
      const cost = cash * (1 - feesPct);
      qty = cost / price;
      entryPrice = price;
      cash = 0;
      trades.push({ time: candles[i].time, side: "buy", price, quantity: qty });
    } else if (signal[i] === "sell" && qty > 0) {
      cash = qty * price * (1 - feesPct);
      trades.push({ time: candles[i].time, side: "sell", price, quantity: qty });
      qty = 0;
    }
    const equity = cash + qty * price;
    const benchmark = config.initialCapital * (price / startPrice);
    equityCurve.push({ time: candles[i].time, equity, benchmark });
  }

  // Close open position at end
  if (qty > 0) {
    const price = closes[closes.length - 1];
    cash = qty * price * (1 - feesPct);
    trades.push({ time: candles[candles.length - 1].time, side: "sell", price, quantity: qty });
    qty = 0;
    equityCurve[equityCurve.length - 1].equity = cash;
  }

  const finalEquity = cash;
  const totalReturn = finalEquity - config.initialCapital;
  const totalReturnPercent = (totalReturn / config.initialCapital) * 100;
  const days = Math.max(1, (candles[candles.length - 1].time - candles[0].time) / 86400);
  const years = days / 365;
  const annualizedReturn = years > 0 ? (Math.pow(finalEquity / config.initialCapital, 1 / years) - 1) * 100 : 0;

  let peak = config.initialCapital;
  let maxDrawdown = 0;
  for (const e of equityCurve) {
    if (e.equity > peak) peak = e.equity;
    const dd = ((peak - e.equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Win rate from round trips
  let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0;
  for (let i = 0; i < trades.length - 1; i++) {
    if (trades[i].side === "buy" && trades[i + 1].side === "sell") {
      const pnl = (trades[i + 1].price - trades[i].price) * trades[i].quantity;
      if (pnl >= 0) { wins++; grossProfit += pnl; }
      else { losses++; grossLoss += Math.abs(pnl); }
    }
  }
  const totalTrades = wins + losses;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  // Simple sharpe from equity returns
  const rets: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    rets.push((equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity);
  }
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance = rets.length ? rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length : 0;
  const sharpeRatio = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  return {
    equityCurve,
    trades,
    metrics: {
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      maxDrawdown,
      sharpeRatio: +sharpeRatio.toFixed(2),
      winRate,
      totalTrades,
      profitFactor: +profitFactor.toFixed(2),
      finalEquity,
    },
    config,
  };
}

function emptyResult(config: BacktestConfig): BacktestResult {
  return {
    equityCurve: [],
    trades: [],
    metrics: {
      totalReturn: 0,
      totalReturnPercent: 0,
      annualizedReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      totalTrades: 0,
      profitFactor: 0,
      finalEquity: config.initialCapital,
    },
    config,
  };
}
