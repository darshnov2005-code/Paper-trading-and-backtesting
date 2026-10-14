"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Portfolio, Position, Trade, MarketSymbol } from "@/types";
import { uid } from "@/lib/utils";

const INITIAL_CASH = 10_00_000; // ₹10 Lakh
const STORAGE_KEY = "paper-trading-portfolio-v2";

const emptyPortfolio = (): Portfolio => ({
  cash: INITIAL_CASH,
  initialCash: INITIAL_CASH,
  positions: {},
  trades: [],
  createdAt: Date.now(),
});

interface PortfolioContextValue {
  portfolio: Portfolio;
  resetPortfolio: () => void;
  buy: (symbol: MarketSymbol, quantity: number, price: number) => { success: boolean; message: string };
  sell: (symbol: string, quantity: number, price: number) => { success: boolean; message: string };
  updatePrices: (prices: Record<string, number>) => void;
  totalValue: number;
  totalPnL: { value: number; percent: number };
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [portfolio, setPortfolio] = useState<Portfolio>(emptyPortfolio);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Portfolio;
        if (parsed && typeof parsed.cash === "number") {
          setPortfolio(parsed);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    }
  }, [portfolio, hydrated]);

  const resetPortfolio = useCallback(() => {
    setPortfolio(emptyPortfolio());
  }, []);

  const buy = useCallback(
    (symbol: MarketSymbol, quantity: number, price: number) => {
      if (quantity <= 0 || !Number.isFinite(quantity)) {
        return { success: false, message: "Invalid quantity" };
      }
      const cost = quantity * price;
      const fees = cost * 0.001;
      const total = cost + fees;

      let result = { success: false, message: "Insufficient cash" };

      setPortfolio((prev) => {
        if (total > prev.cash) return prev;

        const existing = prev.positions[symbol.symbol];
        let newPosition: Position;

        if (existing) {
          const newQty = existing.quantity + quantity;
          const newAvg = (existing.avgCost * existing.quantity + cost) / newQty;
          newPosition = {
            ...existing,
            quantity: newQty,
            avgCost: newAvg,
            currentPrice: price,
            marketValue: newQty * price,
            unrealizedPnL: (price - newAvg) * newQty,
            unrealizedPnLPercent: ((price - newAvg) / newAvg) * 100,
          };
        } else {
          newPosition = {
            symbol: symbol.symbol,
            name: symbol.name,
            quantity,
            avgCost: price,
            currentPrice: price,
            marketValue: quantity * price,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          };
        }

        const trade: Trade = {
          id: uid(),
          symbol: symbol.symbol,
          name: symbol.name,
          side: "buy",
          quantity,
          price,
          total: cost,
          timestamp: Date.now(),
          fees,
        };

        result = { success: true, message: `Bought ${quantity} ${symbol.symbol}` };

        return {
          ...prev,
          cash: prev.cash - total,
          positions: {
            ...prev.positions,
            [symbol.symbol]: newPosition,
          },
          trades: [trade, ...prev.trades],
        };
      });

      return result;
    },
    []
  );

  const sell = useCallback((symbol: string, quantity: number, price: number) => {
    if (quantity <= 0 || !Number.isFinite(quantity)) {
      return { success: false, message: "Invalid quantity" };
    }

    let result = { success: false, message: "Insufficient shares" };

    setPortfolio((prev) => {
      const existing = prev.positions[symbol];
      if (!existing || existing.quantity < quantity) return prev;

      const proceeds = quantity * price;
      const fees = proceeds * 0.001;
      const net = proceeds - fees;

      const remainingQty = existing.quantity - quantity;
      const newPositions = { ...prev.positions };

      if (remainingQty <= 1e-8) {
        delete newPositions[symbol];
      } else {
        newPositions[symbol] = {
          ...existing,
          quantity: remainingQty,
          currentPrice: price,
          marketValue: remainingQty * price,
          unrealizedPnL: (price - existing.avgCost) * remainingQty,
          unrealizedPnLPercent: ((price - existing.avgCost) / existing.avgCost) * 100,
        };
      }

      const trade: Trade = {
        id: uid(),
        symbol,
        name: existing.name,
        side: "sell",
        quantity,
        price,
        total: proceeds,
        timestamp: Date.now(),
        fees,
      };

      result = { success: true, message: `Sold ${quantity} ${symbol}` };

      return {
        ...prev,
        cash: prev.cash + net,
        positions: newPositions,
        trades: [trade, ...prev.trades],
      };
    });

    return result;
  }, []);

  const updatePrices = useCallback((prices: Record<string, number>) => {
    setPortfolio((prev) => {
      const newPositions = { ...prev.positions };
      let changed = false;
      for (const sym of Object.keys(newPositions)) {
        if (prices[sym] != null) {
          const p = newPositions[sym];
          const price = prices[sym];
          newPositions[sym] = {
            ...p,
            currentPrice: price,
            marketValue: p.quantity * price,
            unrealizedPnL: (price - p.avgCost) * p.quantity,
            unrealizedPnLPercent: ((price - p.avgCost) / p.avgCost) * 100,
          };
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, positions: newPositions };
    });
  }, []);

  const totalValue =
    portfolio.cash +
    Object.values(portfolio.positions).reduce((sum, p) => sum + p.marketValue, 0);

  const totalPnL = {
    value: totalValue - portfolio.initialCash,
    percent: ((totalValue - portfolio.initialCash) / portfolio.initialCash) * 100,
  };

  return (
    <PortfolioContext.Provider
      value={{
        portfolio,
        resetPortfolio,
        buy,
        sell,
        updatePrices,
        totalValue,
        totalPnL,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}
