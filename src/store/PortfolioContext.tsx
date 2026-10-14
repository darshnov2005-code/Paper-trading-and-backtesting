"use client";
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { Portfolio, Position, Trade, MarketSymbol } from "@/types";
import { uid } from "@/lib/utils";

const INITIAL_CASH = 10_00_000;
const STORAGE_KEY = "paper-trading-portfolio-v2";
const emptyPortfolio = (): Portfolio => ({ cash: INITIAL_CASH, initialCash: INITIAL_CASH, positions: {}, trades: [], createdAt: Date.now() });

interface BuyOpts { product?: "MIS" | "NRML" | "CNC"; stopLoss?: number; target?: number; }
interface PortfolioContextValue {
  portfolio: Portfolio;
  resetPortfolio: () => void;
  buy: (symbol: MarketSymbol, quantity: number, price: number, opts?: BuyOpts) => { success: boolean; message: string };
  sell: (symbol: string, quantity: number, price: number) => { success: boolean; message: string };
  setStopLoss: (symbol: string, stopLoss: number | undefined) => void;
  setTarget: (symbol: string, target: number | undefined) => void;
  updatePrices: (prices: Record<string, number>) => void;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  analytics: { winRate: number; totalTrades: number; winningTrades: number; losingTrades: number; avgWin: number; avgLoss: number; profitFactor: number; realizedPnL: number; dailyPnL: { date: string; pnl: number }[] };
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [portfolio, setPortfolio] = useState<Portfolio>(emptyPortfolio);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const parsed = JSON.parse(raw) as Portfolio; if (parsed?.cash != null) setPortfolio(parsed); }
    } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio)); }, [portfolio, hydrated]);

  const resetPortfolio = useCallback(() => setPortfolio(emptyPortfolio()), []);

  const buy = useCallback((symbol: MarketSymbol, quantity: number, price: number, opts?: BuyOpts) => {
    if (quantity <= 0 || !Number.isFinite(quantity)) return { success: false, message: "Invalid quantity" };
    const cost = quantity * price;
    const fees = Math.min(20, cost * 0.0003);
    const total = cost + fees;
    let result = { success: false, message: "Insufficient cash" };
    setPortfolio((prev) => {
      if (total > prev.cash) return prev;
      const existing = prev.positions[symbol.symbol];
      let newPosition: Position;
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvg = (existing.avgCost * existing.quantity + cost) / newQty;
        newPosition = { ...existing, quantity: newQty, avgCost: newAvg, currentPrice: price, marketValue: newQty * price, unrealizedPnL: (price - newAvg) * newQty, unrealizedPnLPercent: ((price - newAvg) / newAvg) * 100, stopLoss: opts?.stopLoss ?? existing.stopLoss, target: opts?.target ?? existing.target, product: opts?.product ?? existing.product };
      } else {
        newPosition = { symbol: symbol.symbol, name: symbol.name, quantity, avgCost: price, currentPrice: price, marketValue: cost, unrealizedPnL: 0, unrealizedPnLPercent: 0, product: opts?.product || "MIS", stopLoss: opts?.stopLoss, target: opts?.target };
      }
      const trade: Trade = { id: uid(), symbol: symbol.symbol, name: symbol.name, side: "buy", quantity, price, total, timestamp: Date.now(), fees, product: opts?.product, stopLoss: opts?.stopLoss, target: opts?.target };
      result = { success: true, message: `Bought ${quantity} ${symbol.symbol}` };
      return { ...prev, cash: prev.cash - total, positions: { ...prev.positions, [symbol.symbol]: newPosition }, trades: [trade, ...prev.trades] };
    });
    return result;
  }, []);

  const sell = useCallback((symbol: string, quantity: number, price: number) => {
    if (quantity <= 0 || !Number.isFinite(quantity)) return { success: false, message: "Invalid quantity" };
    let result = { success: false, message: "No position" };
    setPortfolio((prev) => {
      const existing = prev.positions[symbol];
      if (!existing || existing.quantity < quantity) { result = { success: false, message: "Insufficient quantity" }; return prev; }
      const proceeds = quantity * price;
      const fees = Math.min(20, proceeds * 0.0003);
      const net = proceeds - fees;
      const realizedPnL = (price - existing.avgCost) * quantity - fees;
      const remainingQty = existing.quantity - quantity;
      const newPositions = { ...prev.positions };
      if (remainingQty <= 1e-8) delete newPositions[symbol];
      else newPositions[symbol] = { ...existing, quantity: remainingQty, currentPrice: price, marketValue: remainingQty * price, unrealizedPnL: (price - existing.avgCost) * remainingQty, unrealizedPnLPercent: ((price - existing.avgCost) / existing.avgCost) * 100 };
      const trade: Trade = { id: uid(), symbol, name: existing.name, side: "sell", quantity, price, total: net, timestamp: Date.now(), fees, product: existing.product, pnl: realizedPnL };
      result = { success: true, message: `Sold ${quantity} ${symbol}` };
      return { ...prev, cash: prev.cash + net, positions: newPositions, trades: [trade, ...prev.trades] };
    });
    return result;
  }, []);

  const setStopLoss = useCallback((symbol: string, stopLoss: number | undefined) => {
    setPortfolio((prev) => { const p = prev.positions[symbol]; if (!p) return prev; return { ...prev, positions: { ...prev.positions, [symbol]: { ...p, stopLoss } } }; });
  }, []);
  const setTarget = useCallback((symbol: string, target: number | undefined) => {
    setPortfolio((prev) => { const p = prev.positions[symbol]; if (!p) return prev; return { ...prev, positions: { ...prev.positions, [symbol]: { ...p, target } } }; });
  }, []);

  const updatePrices = useCallback((prices: Record<string, number>) => {
    setPortfolio((prev) => {
      const newPositions = { ...prev.positions };
      let changed = false;
      const extraTrades: Trade[] = [];
      let cashAdd = 0;
      for (const sym of Object.keys(newPositions)) {
        if (prices[sym] == null) continue;
        const p = newPositions[sym];
        const price = prices[sym];
        if (p.stopLoss != null && price <= p.stopLoss && p.quantity > 0) {
          const qty = p.quantity; const proceeds = qty * price; const fees = Math.min(20, proceeds * 0.0003);
          const realizedPnL = (price - p.avgCost) * qty - fees; cashAdd += proceeds - fees;
          extraTrades.push({ id: uid(), symbol: sym, name: p.name, side: "sell", quantity: qty, price, total: proceeds - fees, timestamp: Date.now(), fees, product: p.product, pnl: realizedPnL });
          delete newPositions[sym]; changed = true; continue;
        }
        if (p.target != null && price >= p.target && p.quantity > 0) {
          const qty = p.quantity; const proceeds = qty * price; const fees = Math.min(20, proceeds * 0.0003);
          const realizedPnL = (price - p.avgCost) * qty - fees; cashAdd += proceeds - fees;
          extraTrades.push({ id: uid(), symbol: sym, name: p.name, side: "sell", quantity: qty, price, total: proceeds - fees, timestamp: Date.now(), fees, product: p.product, pnl: realizedPnL });
          delete newPositions[sym]; changed = true; continue;
        }
        newPositions[sym] = { ...p, currentPrice: price, marketValue: p.quantity * price, unrealizedPnL: (price - p.avgCost) * p.quantity, unrealizedPnLPercent: ((price - p.avgCost) / p.avgCost) * 100 };
        changed = true;
      }
      if (!changed && extraTrades.length === 0) return prev;
      return { ...prev, cash: prev.cash + cashAdd, positions: newPositions, trades: [...extraTrades, ...prev.trades] };
    });
  }, []);

  const totalValue = useMemo(() => portfolio.cash + Object.values(portfolio.positions).reduce((s, p) => s + p.marketValue, 0), [portfolio]);
  const totalPnL = totalValue - portfolio.initialCash;
  const totalPnLPercent = (totalPnL / portfolio.initialCash) * 100;

  const analytics = useMemo(() => {
    const sells = portfolio.trades.filter((t) => t.side === "sell" && t.pnl != null);
    const wins = sells.filter((t) => (t.pnl || 0) > 0);
    const losses = sells.filter((t) => (t.pnl || 0) <= 0);
    const totalWin = wins.reduce((s, t) => s + (t.pnl || 0), 0);
    const totalLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
    const realizedPnL = sells.reduce((s, t) => s + (t.pnl || 0), 0);
    const byDay: Record<string, number> = {};
    for (const t of sells) { const d = new Date(t.timestamp).toISOString().slice(0, 10); byDay[d] = (byDay[d] || 0) + (t.pnl || 0); }
    const dailyPnL = Object.entries(byDay).map(([date, pnl]) => ({ date, pnl })).sort((a, b) => a.date.localeCompare(b.date));
    return { winRate: sells.length ? (wins.length / sells.length) * 100 : 0, totalTrades: sells.length, winningTrades: wins.length, losingTrades: losses.length, avgWin: wins.length ? totalWin / wins.length : 0, avgLoss: losses.length ? totalLoss / losses.length : 0, profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? 99 : 0, realizedPnL, dailyPnL };
  }, [portfolio.trades]);

  return (
    <PortfolioContext.Provider value={{ portfolio, resetPortfolio, buy, sell, setStopLoss, setTarget, updatePrices, totalValue, totalPnL, totalPnLPercent, analytics }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}
